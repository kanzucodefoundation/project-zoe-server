/**
 * sync-prod-qbo-customers-to-sandbox.ts
 *
 * Reads all active customers from production QuickBooks and mirrors them into
 * the staging QBO sandbox, then writes CONTACT → CUSTOMER mappings in the
 * staging Zoe DB pointing at sandbox IDs — never production IDs.
 *
 * Production QBO is STRICTLY READ-ONLY. Only HTTP GET requests are issued
 * against the production base URL. There is no postToProd() function.
 * Refreshed production tokens are written back to .env.prod only, never to
 * any database.
 *
 * For each production customer it:
 *   - Creates the matching customer in the QBO sandbox (idempotent by DisplayName)
 *   - Preserves the campus (Location) parent → sub-customer hierarchy
 *   - Finds the matching Zoe contact (phone first, then full name)
 *   - Creates the Zoe contact if none exists (same logic as import-qbo-customers.ts)
 *   - Writes a CONTACT → CUSTOMER mapping pointing at the sandbox customer ID
 *
 * Prerequisites:
 *   1. .env loaded (staging DB credentials, sandbox QUICKBOOKS_CLIENT_ID/SECRET,
 *      SEED_TENANT_ID, QUICKBOOKS_ENVIRONMENT=sandbox)
 *   2. .env.prod present alongside .env with:
 *        PROD_QBO_CLIENT_ID=...
 *        PROD_QBO_CLIENT_SECRET=...
 *        PROD_QBO_ACCESS_TOKEN=...    # from your local DB after OAuth against prod
 *        PROD_QBO_REFRESH_TOKEN=...
 *        PROD_QBO_REALM_ID=...
 *   3. Staging QBO sandbox connection already stored in Zoe DB for SEED_TENANT_ID
 *      (run seed-qbo-sandbox.ts first if not done — it sets up Departments/Classes)
 *
 * Run:
 *   npm run sync:qbo-customers-to-sandbox -- --dry-run   # report only, no writes
 *   npm run sync:qbo-customers-to-sandbox
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Connection, Repository } from 'typeorm';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from '../src/integrations/quickbooks/entities/external-system-mapping.entity';
import Contact from '../src/crm/entities/contact.entity';
import Person from '../src/crm/entities/person.entity';
import Phone from '../src/crm/entities/phone.entity';
import Email from '../src/crm/entities/email.entity';
import Group from '../src/groups/entities/group.entity';
import GroupMembership from '../src/groups/entities/groupMembership.entity';
import { ContactCategory } from '../src/crm/enums/contactCategory';
import { Gender } from '../src/crm/enums/gender';
import { GroupCategoryPurpose } from '../src/groups/enums/groups';

dotenv.config();
const PROD_ENV_FILE = path.resolve(process.cwd(), '.env.prod');
dotenv.config({ path: PROD_ENV_FILE, override: false });

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const SYSTEM = 'QUICKBOOKS';
const MINOR_VERSION = 65;
const PROD_BASE = 'https://quickbooks.api.intuit.com';
const SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com';

// ─── Production token management ─────────────────────────────────────────────
// Always refresh on startup — tokens from .env.prod may be hours old.
// Refreshed tokens are written back to .env.prod only, never to any DB.

async function getProdTokens(): Promise<{
  accessToken: string;
  realmId: string;
}> {
  const realmId = process.env.PROD_QBO_REALM_ID;
  const refreshToken = process.env.PROD_QBO_REFRESH_TOKEN;
  const clientId = process.env.PROD_QBO_CLIENT_ID;
  const clientSecret = process.env.PROD_QBO_CLIENT_SECRET;

  if (!realmId || !refreshToken || !clientId || !clientSecret) {
    throw new Error(
      'Missing production QBO credentials in .env.prod.\n' +
        'Required: PROD_QBO_CLIENT_ID, PROD_QBO_CLIENT_SECRET, ' +
        'PROD_QBO_REFRESH_TOKEN, PROD_QBO_REALM_ID',
    );
  }

  console.log('Refreshing production QBO access token...');
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );
  const { data } = await axios.post(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  const newAccessToken: string = data.access_token;
  const newRefreshToken: string = data.refresh_token;

  // Write refreshed tokens back to .env.prod — no DB involved.
  if (fs.existsSync(PROD_ENV_FILE)) {
    let content = fs.readFileSync(PROD_ENV_FILE, 'utf8');
    content = content
      .replace(
        /^PROD_QBO_ACCESS_TOKEN=.*/m,
        `PROD_QBO_ACCESS_TOKEN=${newAccessToken}`,
      )
      .replace(
        /^PROD_QBO_REFRESH_TOKEN=.*/m,
        `PROD_QBO_REFRESH_TOKEN=${newRefreshToken}`,
      );
    fs.writeFileSync(PROD_ENV_FILE, content, 'utf8');
    console.log('  ✓ Refreshed tokens written back to .env.prod');
  }

  return { accessToken: newAccessToken, realmId };
}

// ─── Production QBO — GET only. There is intentionally no postToProd(). ──────

async function queryProd<T>(
  query: string,
  accessToken: string,
  realmId: string,
): Promise<T[]> {
  const { data } = await axios.get(`${PROD_BASE}/v3/company/${realmId}/query`, {
    params: { query, minorversion: MINOR_VERSION },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const qr = data?.QueryResponse ?? {};
  return (Object.values(qr).find(Array.isArray) as T[]) ?? [];
}

async function fetchAllProdCustomers(
  accessToken: string,
  realmId: string,
): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;
  for (let start = 1; ; start += pageSize) {
    const page = await queryProd<any>(
      `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${start} MAXRESULTS ${pageSize}`,
      accessToken,
      realmId,
    );
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

// ─── Sandbox token management ─────────────────────────────────────────────────

async function getSandboxTokens(
  connRepo: Repository<ExternalSystemConnection>,
): Promise<{ accessToken: string; realmId: string }> {
  const rec = await connRepo.findOne({
    where: { tenantId: TENANT_ID, system: 'quickbooks' },
  });
  if (!rec) {
    throw new Error(
      `No QBO sandbox connection for tenant ${TENANT_ID}.\n` +
        'Connect the sandbox account in the Zoe app first, then run seed-qbo-sandbox.ts.',
    );
  }

  if (rec.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log('Refreshing sandbox QBO access token...');
    const credentials = Buffer.from(
      `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`,
    ).toString('base64');
    const { data } = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rec.refreshToken,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    rec.accessToken = data.access_token;
    rec.refreshToken = data.refresh_token;
    rec.accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    await connRepo.save(rec);
    console.log('  ✓ Sandbox token refreshed');
  }

  return { accessToken: rec.accessToken, realmId: rec.realmId };
}

// ─── Sandbox QBO — read + write ───────────────────────────────────────────────

async function querySandbox<T>(
  query: string,
  accessToken: string,
  realmId: string,
): Promise<T[]> {
  const { data } = await axios.get(
    `${SANDBOX_BASE}/v3/company/${realmId}/query`,
    {
      params: { query, minorversion: MINOR_VERSION },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  const qr = data?.QueryResponse ?? {};
  return (Object.values(qr).find(Array.isArray) as T[]) ?? [];
}

async function postToSandbox(
  endpoint: string,
  body: any,
  accessToken: string,
  realmId: string,
): Promise<any> {
  const url = `${SANDBOX_BASE}/v3/company/${realmId}${endpoint}?minorversion=${MINOR_VERSION}`;
  try {
    const { data } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return data;
  } catch (err: any) {
    const qboErrors = err?.response?.data?.Fault?.Error ?? [];
    const msg = qboErrors
      .map((e: any) => `[${e.code}] ${e.Message}: ${e.Detail}`)
      .join('; ');
    throw new Error(`QBO POST ${endpoint} failed: ${msg || err.message}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

const normalize = (v: string): string =>
  (v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const digitsOnly = (v?: string | null): string => (v ?? '').replace(/\D/g, '');

function splitName(customer: any): { first: string; last: string } {
  const given = String(customer.GivenName ?? '').trim();
  const family = String(customer.FamilyName ?? '').trim();
  if (given || family) return { first: given || family, last: family || given };
  const parts = String(customer.DisplayName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { first: 'Unknown', last: 'Unknown' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function inferGender(customer: any, fallback: Gender | null): Gender | null {
  const title = String(customer.Title ?? '')
    .toLowerCase()
    .replace(/\./g, '');
  if (title === 'mr' || title === 'sir') return Gender.Male;
  if (['mrs', 'ms', 'miss', 'madam'].includes(title)) return Gender.Female;
  return fallback;
}

async function upsertMapping(
  repo: Repository<ExternalSystemMapping>,
  opts: {
    internalReferenceType: string;
    internalReferenceId: string | number;
    externalReferenceType: string;
    externalReferenceId: string;
    externalReferenceName?: string;
  },
) {
  const existing = await repo.findOne({
    where: {
      tenantId: TENANT_ID,
      system: SYSTEM,
      internalReferenceType: opts.internalReferenceType,
      internalReferenceId: String(opts.internalReferenceId),
      externalReferenceType: opts.externalReferenceType,
    },
  });
  const record =
    existing ?? repo.create({ tenantId: TENANT_ID, system: SYSTEM });
  Object.assign(record, {
    internalReferenceType: opts.internalReferenceType,
    internalReferenceId: String(opts.internalReferenceId),
    externalReferenceType: opts.externalReferenceType,
    externalReferenceId: opts.externalReferenceId,
    externalReferenceName: opts.externalReferenceName ?? null,
    lastSyncedAt: new Date(),
  });
  return repo.save(record);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const connection: Connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const groupRepo = connection.getRepository(Group);
  const contactRepo = connection.getRepository(Contact);
  const personRepo = connection.getRepository(Person);
  const phoneRepo = connection.getRepository(Phone);
  const emailRepo = connection.getRepository(Email);
  const membershipRepo = connection.getRepository(GroupMembership);

  const [
    { accessToken: prodToken, realmId: prodRealm },
    { accessToken: sbToken, realmId: sbRealm },
  ] = await Promise.all([getProdTokens(), getSandboxTokens(connRepo)]);

  console.log(`\nProduction realm : ${prodRealm}`);
  console.log(`Sandbox realm    : ${sbRealm}`);
  if (dryRun) console.log('\nDRY RUN — nothing will be written.\n');

  // ── Fetch all production customers ────────────────────────────────────────
  console.log(
    '\nFetching all active customers from production QBO (read-only)...',
  );
  const prodCustomers = await fetchAllProdCustomers(prodToken, prodRealm);
  console.log(`  Found ${prodCustomers.length} production customers.`);

  const prodById = new Map<string, any>(
    prodCustomers.map((c) => [String(c.Id), c]),
  );

  // ── Load Zoe staging Location groups (for campus matching) ────────────────
  const zoeGroups = await groupRepo.find({
    where: { tenant: { id: TENANT_ID } },
    relations: ['category'],
  });
  const locationByName = new Map<string, Group>();
  for (const g of zoeGroups) {
    if (g.category?.purpose === GroupCategoryPurpose.LOCATION) {
      locationByName.set(normalize(g.name), g);
    }
  }
  console.log(`  Zoe has ${locationByName.size} Location groups.`);

  // ── Load existing sandbox customers by DisplayName (for idempotency) ──────
  console.log('\nFetching existing sandbox customers...');
  const sbExistingRaw = await querySandbox<any>(
    'SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000',
    sbToken,
    sbRealm,
  );
  // keyed by normalised DisplayName for fast lookup
  const sbByName = new Map<string, any>(
    sbExistingRaw.map((c) => [normalize(c.DisplayName ?? ''), c]),
  );
  console.log(`  Sandbox already has ${sbExistingRaw.length} customers.`);

  // ── Pass 1: campus customers ──────────────────────────────────────────────
  // A production customer is treated as a campus when its DisplayName matches
  // a Zoe Location group. Create it in sandbox as a top-level customer and
  // write a GROUP → CUSTOMER mapping.
  console.log('\nPass 1: campus customers...');

  const prodCampusIds = new Set<string>();
  // prod campus QBO ID → sandbox QBO ID, needed to parent person customers
  const campusProdToSandbox = new Map<string, string>();

  for (const c of prodCustomers) {
    const zoeGroup = locationByName.get(normalize(c.DisplayName ?? ''));
    if (!zoeGroup) continue;

    prodCampusIds.add(String(c.Id));
    const displayName: string = c.DisplayName;

    let sbId: string;
    const existing = sbByName.get(normalize(displayName));
    if (existing) {
      sbId = String(existing.Id);
    } else if (!dryRun) {
      const res = await postToSandbox(
        '/customer',
        { DisplayName: displayName, CompanyName: displayName },
        sbToken,
        sbRealm,
      );
      sbId = String(res.Customer.Id);
      sbByName.set(normalize(displayName), res.Customer);
      console.log(`  + Campus: ${displayName} (sandbox Id=${sbId})`);
    } else {
      sbId = 'DRY_RUN';
    }

    campusProdToSandbox.set(String(c.Id), sbId);

    if (!dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: zoeGroup.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: sbId,
        externalReferenceName: displayName,
      });
    }
  }
  console.log(`  Campus customers processed: ${prodCampusIds.size}`);

  // ── Pass 2: person customers ──────────────────────────────────────────────
  // For each non-campus production customer:
  //   1. Resolve sandbox parent from the production parent ID
  //   2. Find or create the customer in sandbox (preserving campus hierarchy)
  //   3. Find or create the Zoe contact (phone → name fallback)
  //   4. Write CONTACT → CUSTOMER mapping pointing at the sandbox ID
  console.log('\nPass 2: person customers...');

  const stats = {
    alreadyMapped: 0,
    sbCreated: 0,
    sbReused: 0,
    contactCreated: 0,
    contactMatched: 0,
    noParent: 0,
    failed: 0,
  };

  for (const c of prodCustomers) {
    const prodId = String(c.Id);
    if (prodCampusIds.has(prodId)) continue;

    // Resolve the sandbox parent ID from the production parent reference
    const prodParentId = c.ParentRef?.value ? String(c.ParentRef.value) : null;
    const sbParentId = prodParentId
      ? campusProdToSandbox.get(prodParentId)
      : null;
    if (!sbParentId) {
      stats.noParent++;
      continue;
    }

    const { first, last } = splitName(c);
    const displayName: string = c.DisplayName ?? `${first} ${last}`.trim();
    const phoneValue: string | undefined =
      c.PrimaryPhone?.FreeFormNumber ?? c.Mobile?.FreeFormNumber;
    const emailValue: string | undefined = c.PrimaryEmailAddr?.Address;
    const gender = inferGender(c, null);

    // ── Find or create in sandbox ──────────────────────────────────────────
    let sbId: string;
    const sbExisting = sbByName.get(normalize(displayName));
    if (sbExisting) {
      sbId = String(sbExisting.Id);
      stats.sbReused++;
    } else if (!dryRun) {
      const body: Record<string, any> = {
        DisplayName: displayName,
        ParentRef: { value: sbParentId },
        Job: true,
      };
      if (c.GivenName) body.GivenName = c.GivenName;
      if (c.FamilyName) body.FamilyName = c.FamilyName;
      if (phoneValue) body.PrimaryPhone = { FreeFormNumber: phoneValue };
      if (emailValue) body.PrimaryEmailAddr = { Address: emailValue };

      try {
        const res = await postToSandbox('/customer', body, sbToken, sbRealm);
        sbId = String(res.Customer.Id);
        sbByName.set(normalize(displayName), res.Customer);
        stats.sbCreated++;
      } catch (err: any) {
        console.log(
          `  ✗ Sandbox create failed for "${displayName}": ${err.message}`,
        );
        stats.failed++;
        continue;
      }
    } else {
      sbId = 'DRY_RUN';
      stats.sbCreated++;
    }

    // ── Find or create Zoe contact ─────────────────────────────────────────
    let contact: Contact | null = null;

    // Already has a CONTACT → CUSTOMER mapping? Skip.
    // We look up by sandbox ID (not prod ID) to stay consistent.
    if (sbId !== 'DRY_RUN') {
      const existingMap = await mappingRepo.findOne({
        where: {
          tenantId: TENANT_ID,
          system: SYSTEM,
          internalReferenceType: 'CONTACT',
          externalReferenceType: 'CUSTOMER',
          externalReferenceId: sbId,
        },
      });
      if (existingMap) {
        stats.alreadyMapped++;
        continue;
      }
    }

    // Phone match (last 9 digits)
    if (phoneValue) {
      const tail = digitsOnly(phoneValue).slice(-9);
      if (tail.length === 9) {
        const phoneRow = await phoneRepo
          .createQueryBuilder('phone')
          .innerJoin('phone.contact', 'contact')
          .where('contact.tenantId = :tenantId', { tenantId: TENANT_ID })
          .andWhere("regexp_replace(phone.value, '\\D', '', 'g') LIKE :tail", {
            tail: `%${tail}`,
          })
          .getOne();
        if (phoneRow) {
          contact = await contactRepo.findOne({
            where: { id: phoneRow.contactId },
          });
        }
      }
    }

    // Name match fallback
    if (!contact) {
      const person = await personRepo
        .createQueryBuilder('person')
        .innerJoin('person.contact', 'contact')
        .where('contact.tenantId = :tenantId', { tenantId: TENANT_ID })
        .andWhere('LOWER(person.firstName) = :first', {
          first: first.toLowerCase(),
        })
        .andWhere('LOWER(person.lastName) = :last', {
          last: last.toLowerCase(),
        })
        .getOne();
      if (person) {
        contact = await contactRepo.findOne({
          where: { id: person.contactId },
        });
      }
    }

    // Create Zoe contact if still not found
    if (!contact && !dryRun) {
      contact = await contactRepo.save(
        contactRepo.create({
          tenantId: TENANT_ID,
          category: ContactCategory.Person,
        }),
      );
      await personRepo.save(
        personRepo.create({
          contactId: contact.id,
          firstName: first,
          lastName: last,
          gender,
        }),
      );
      if (phoneValue) {
        await phoneRepo.save(
          phoneRepo.create({
            contactId: contact.id,
            value: phoneValue,
            isPrimary: true,
          }),
        );
      }
      if (emailValue) {
        await emailRepo.save(
          emailRepo.create({
            contactId: contact.id,
            value: emailValue,
            isPrimary: true,
          }),
        );
      }

      // Place the new contact in their campus Location group
      const parentProd = prodParentId ? prodById.get(prodParentId) : null;
      const campusGroup = parentProd
        ? locationByName.get(normalize(parentProd.DisplayName ?? ''))
        : null;
      if (campusGroup) {
        await membershipRepo.save(
          membershipRepo.create({
            contactId: contact.id,
            groupId: campusGroup.id,
            isActive: true,
          }),
        );
      }

      stats.contactCreated++;
    } else if (contact) {
      stats.contactMatched++;
    } else {
      // dry run: count as created
      stats.contactCreated++;
    }

    if (!dryRun && contact) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'CONTACT',
        internalReferenceId: contact.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: sbId,
        externalReferenceName: displayName,
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(dryRun ? 'DRY RUN SUMMARY' : 'SYNC COMPLETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Campus customers synced           : ${prodCampusIds.size}`);
  console.log(`  Person customers created in SB    : ${stats.sbCreated}`);
  console.log(`  Person customers reused in SB     : ${stats.sbReused}`);
  console.log(`  Already mapped, skipped           : ${stats.alreadyMapped}`);
  console.log(`  Zoe contacts matched              : ${stats.contactMatched}`);
  console.log(`  Zoe contacts created              : ${stats.contactCreated}`);
  console.log(`  Skipped (no campus parent in SB)  : ${stats.noParent}`);
  console.log(`  Failed (sandbox API error)        : ${stats.failed}`);
  console.log('══════════════════════════════════════════════════════════\n');

  await connection.close();
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
