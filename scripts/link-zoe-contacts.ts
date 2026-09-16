/**
 * link-zoe-contacts.ts
 *
 * Links people who already exist in Project Zoe to their QuickBooks customer.
 *
 * This is the counterpart to `import-qbo-customers.ts`. That script walks
 * QuickBooks and creates anyone missing from Zoe; this one walks Zoe and finds
 * the customer for people who are already here — the CRM contacts that predate
 * the integration and would otherwise have to be mapped one at a time in the
 * posting dialog.
 *
 * Matching, strongest first:
 *   1. phone number — compared on the last 9 digits, so +256772…, 0772… and
 *      256772… are all the same person
 *   2. exact name — the contact's full name against the customer DisplayName
 *
 * Anyone who still has no customer is created in QuickBooks, as a sub-customer
 * of their campus — falling back to the mother group (Central) when they belong
 * to no location, exactly as posting does. Pass `--link-only` to match without
 * creating anything.
 *
 * Run:
 *   npm run link:contacts -- --dry-run     # report only, write nothing
 *   npm run link:contacts                  # match, then create the rest
 *   npm run link:contacts -- --link-only   # match only, create nothing
 *
 * Idempotent: already-linked contacts are skipped, so it is safe to re-run.
 */

import 'reflect-metadata';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Connection, Repository } from 'typeorm';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from '../src/integrations/quickbooks/entities/external-system-mapping.entity';
import Contact from '../src/crm/entities/contact.entity';
import Group from '../src/groups/entities/group.entity';
import GroupMembership from '../src/groups/entities/groupMembership.entity';
import { GroupCategoryPurpose } from '../src/groups/enums/groups';

dotenv.config();

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const SYSTEM = 'QUICKBOOKS';
const MINOR_VERSION = 65;

const QBO_BASE =
  (process.env.QUICKBOOKS_ENVIRONMENT ?? 'sandbox') === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

// ─── QuickBooks plumbing ─────────────────────────────────────────────────────

async function getTokens(repo: Repository<ExternalSystemConnection>) {
  const rec = await repo.findOne({
    where: { tenantId: TENANT_ID, system: 'quickbooks' },
  });
  if (!rec) {
    throw new Error(
      `No QuickBooks connection for tenant ${TENANT_ID}. Connect it in the app first.`,
    );
  }

  if (rec.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log('Refreshing QuickBooks access token…');
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
    await repo.save(rec);
  }

  return { accessToken: rec.accessToken, realmId: rec.realmId };
}

async function qboQuery(
  query: string,
  accessToken: string,
  realmId: string,
): Promise<any[]> {
  const { data } = await axios.get(
    `${QBO_BASE}/v3/company/${realmId}/query?minorversion=${MINOR_VERSION}`,
    {
      params: { query },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  const response = data?.QueryResponse ?? {};
  return (Object.values(response).find(Array.isArray) as any[]) ?? [];
}

async function qboCreateCustomer(
  body: any,
  accessToken: string,
  realmId: string,
): Promise<any> {
  try {
    const { data } = await axios.post(
      `${QBO_BASE}/v3/company/${realmId}/customer?minorversion=${MINOR_VERSION}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    return data.Customer;
  } catch (err: any) {
    const faults = err?.response?.data?.Fault?.Error ?? [];
    const detail = faults
      .map((e: any) => `[${e.code}] ${e.Message}: ${e.Detail}`)
      .join('; ');
    throw new Error(detail || err.message);
  }
}

async function fetchAllCustomers(accessToken: string, realmId: string) {
  const all: any[] = [];
  const pageSize = 1000;
  for (let start = 1; ; start += pageSize) {
    const page = await qboQuery(
      `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${start} MAXRESULTS ${pageSize}`,
      accessToken,
      realmId,
    );
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeName = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Escapes a value for a QuickBooks query literal. Intuit escapes a single quote
 * with a backslash; a name like O'Brien would otherwise end the literal early
 * and fail the query.
 */
const escapeQboLiteral = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Last 9 digits — what makes a Ugandan number comparable across formats. */
const phoneKey = (value?: string | null): string | null => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
};

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
  if (existing) {
    existing.externalReferenceId = opts.externalReferenceId;
    existing.externalReferenceName =
      opts.externalReferenceName ?? existing.externalReferenceName;
    existing.lastSyncedAt = new Date();
    return repo.save(existing);
  }
  return repo.save(
    repo.create({
      tenantId: TENANT_ID,
      system: SYSTEM,
      internalReferenceType: opts.internalReferenceType,
      internalReferenceId: String(opts.internalReferenceId),
      externalReferenceType: opts.externalReferenceType,
      externalReferenceId: opts.externalReferenceId,
      externalReferenceName: opts.externalReferenceName ?? null,
      lastSyncedAt: new Date(),
    }),
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  // Creating the stragglers is the point of the run, so it is the default.
  const createMissing = !args.includes('--link-only');

  const connection: Connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const contactRepo = connection.getRepository(Contact);
  const groupRepo = connection.getRepository(Group);
  const membershipRepo = connection.getRepository(GroupMembership);

  const { accessToken, realmId } = await getTokens(connRepo);
  console.log(`QuickBooks realm ${realmId}`);
  if (dryRun) console.log('\nDRY RUN — nothing will be written.\n');

  // ── What is already linked ─────────────────────────────────────────────────
  const existingMappings = await mappingRepo.find({
    where: {
      tenantId: TENANT_ID,
      system: SYSTEM,
      internalReferenceType: 'CONTACT',
      externalReferenceType: 'CUSTOMER',
    },
  });
  const linkedContactIds = new Set(
    existingMappings.map((m) => Number(m.internalReferenceId)),
  );
  const claimedCustomerIds = new Set(
    existingMappings.map((m) => m.externalReferenceId),
  );

  // ── Campus customers, for parenting anything we create ────────────────────
  const campusMappings = await mappingRepo.find({
    where: {
      tenantId: TENANT_ID,
      system: SYSTEM,
      internalReferenceType: 'GROUP',
      externalReferenceType: 'CUSTOMER',
    },
  });
  const campusCustomerByGroupId = new Map(
    campusMappings.map((m) => [
      Number(m.internalReferenceId),
      m.externalReferenceId,
    ]),
  );

  const allGroups = await groupRepo.find({
    where: { tenant: { id: TENANT_ID } },
    relations: ['category'],
  });
  const locationGroupIds = new Set(
    allGroups
      .filter((g) => g.category?.purpose === GroupCategoryPurpose.LOCATION)
      .map((g) => g.id),
  );

  // The mother group — the root of the tree — is where givers with no campus
  // are attributed, so it needs a customer to be a parent of.
  const rootGroup = allGroups
    .filter((g) => !g.parentId)
    .sort((a, b) => a.id - b.id)[0];

  /**
   * The QuickBooks customer standing for a group, created on first use. Keeps
   * the campus hierarchy intact without requiring the seed script to have run.
   */
  const ensureGroupCustomer = async (
    groupId: number,
    groupName: string,
  ): Promise<string | undefined> => {
    const mapped = campusCustomerByGroupId.get(groupId);
    if (mapped) return mapped;

    const escaped = escapeQboLiteral(groupName);
    const existing = await qboQuery(
      `SELECT * FROM Customer WHERE DisplayName = '${escaped}' MAXRESULTS 1`,
      accessToken,
      realmId,
    );

    let customerId: string;
    if (existing.length > 0) {
      customerId = String(existing[0].Id);
    } else {
      if (dryRun) return undefined;
      const created = await qboCreateCustomer(
        { DisplayName: groupName, CompanyName: groupName },
        accessToken,
        realmId,
      );
      customerId = String(created.Id);
      console.log(`  + Created campus customer "${groupName}"`);
    }

    if (!dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: groupId,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: customerId,
        externalReferenceName: groupName,
      });
    }
    campusCustomerByGroupId.set(groupId, customerId);
    return customerId;
  };

  // ── Index QuickBooks customers by phone and by name ───────────────────────
  const customers = await fetchAllCustomers(accessToken, realmId);
  console.log(`Found ${customers.length} active customers in QuickBooks.`);

  const byPhone = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const customer of customers) {
    if (claimedCustomerIds.has(String(customer.Id))) continue;
    const phone = phoneKey(
      customer.PrimaryPhone?.FreeFormNumber ?? customer.Mobile?.FreeFormNumber,
    );
    if (phone && !byPhone.has(phone)) byPhone.set(phone, customer);
    const name = normalizeName(customer.DisplayName ?? '');
    if (name && !byName.has(name)) byName.set(name, customer);
  }

  // ── Walk Zoe's contacts ───────────────────────────────────────────────────
  const contacts = await contactRepo.find({
    where: { tenantId: TENANT_ID },
    relations: ['person', 'phones'],
  });

  const stats = {
    total: contacts.length,
    alreadyLinked: 0,
    byPhone: 0,
    byName: 0,
    created: 0,
    unmatched: 0,
    createFailed: 0,
    parentedToCentral: 0,
    relinkedInactive: 0,
  };
  const unmatchedNames: string[] = [];

  for (const contact of contacts) {
    if (linkedContactIds.has(contact.id)) {
      stats.alreadyLinked++;
      continue;
    }

    const first = contact.person?.firstName ?? '';
    const last = contact.person?.lastName ?? '';
    const fullName = `${first} ${last}`.trim();
    if (!fullName) continue;

    const contactPhones = (contact.phones ?? [])
      .map((p) => phoneKey(p.value))
      .filter(Boolean) as string[];

    let customer: any = null;
    let how: 'phone' | 'name' | null = null;

    for (const phone of contactPhones) {
      const hit = byPhone.get(phone);
      if (hit && !claimedCustomerIds.has(String(hit.Id))) {
        customer = hit;
        how = 'phone';
        break;
      }
    }

    if (!customer) {
      const hit = byName.get(normalizeName(fullName));
      if (hit && !claimedCustomerIds.has(String(hit.Id))) {
        customer = hit;
        how = 'name';
      }
    }

    if (!customer && createMissing) {
      // Parent the new customer to their campus, so giving stays grouped by
      // location the way the posting flow expects.
      const memberships = await membershipRepo.find({
        where: { contactId: contact.id, isActive: true },
      });
      const campusGroupId = memberships
        .map((m) => m.groupId)
        .find((id) => locationGroupIds.has(id));

      // No campus means Central: the mother group, same fallback the posting
      // flow applies, so nobody is left without a parent.
      const parentGroup = campusGroupId
        ? allGroups.find((g) => g.id === campusGroupId)
        : rootGroup;
      const parentId = parentGroup
        ? await ensureGroupCustomer(parentGroup.id, parentGroup.name)
        : undefined;
      if (parentGroup && !campusGroupId) stats.parentedToCentral++;

      const payload: Record<string, any> = { DisplayName: fullName };
      if (first) payload.GivenName = first.slice(0, 25);
      if (last) payload.FamilyName = last.slice(0, 25);
      if (contact.phones?.[0]?.value) {
        payload.PrimaryPhone = { FreeFormNumber: contact.phones[0].value };
      }
      if (parentId) {
        payload.ParentRef = { value: parentId };
        payload.Job = true;
      }

      if (dryRun) {
        stats.created++;
        continue;
      }

      try {
        customer = await qboCreateCustomer(payload, accessToken, realmId);
        stats.created++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Fault 6240 means the DisplayName is taken. QuickBooks enforces that
        // across inactive customers too, which the Active-only listing above
        // never sees — so look the name up without that filter and link to
        // whoever is already there rather than reporting a failure.
        if (message.includes('6240')) {
          const escaped = escapeQboLiteral(fullName);
          const found = await qboQuery(
            `SELECT * FROM Customer WHERE DisplayName = '${escaped}' MAXRESULTS 1`,
            accessToken,
            realmId,
          );
          if (found.length > 0) {
            customer = found[0];
            // `how` drives the byName tally further down; only the
            // inactive-specific count belongs here.
            how = 'name';
            stats.relinkedInactive++;
          }
        }

        if (!customer) {
          stats.createFailed++;
          console.log(`  ! Could not create "${fullName}": ${message}`);
          continue;
        }
      }
    }

    if (!customer) {
      stats.unmatched++;
      if (unmatchedNames.length < 15) unmatchedNames.push(fullName);
      continue;
    }

    if (how === 'phone') stats.byPhone++;
    else if (how === 'name') stats.byName++;

    claimedCustomerIds.add(String(customer.Id));

    if (!dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'CONTACT',
        internalReferenceId: contact.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: String(customer.Id),
        externalReferenceName: customer.DisplayName ?? fullName,
      });
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(dryRun ? 'DRY RUN SUMMARY' : 'LINKING COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`  Contacts in Zoe            : ${stats.total}`);
  console.log(`  Already linked             : ${stats.alreadyLinked}`);
  console.log(`  Linked by phone number     : ${stats.byPhone}`);
  console.log(`  Linked by exact name       : ${stats.byName}`);
  if (createMissing) {
    console.log(`  Created in QuickBooks      : ${stats.created}`);
    if (stats.parentedToCentral > 0) {
      console.log(
        `    of which parented to Central : ${stats.parentedToCentral}`,
      );
    }
    if (stats.relinkedInactive > 0) {
      console.log(
        `  Linked to an existing name : ${stats.relinkedInactive} (inactive in QuickBooks)`,
      );
    }
    if (stats.createFailed > 0) {
      console.log(`  Could not be created       : ${stats.createFailed}`);
    }
  }
  console.log(`  Still unmatched            : ${stats.unmatched}`);

  if (stats.unmatched > 0) {
    console.log(
      `\n  These have no customer in QuickBooks. Re-run without --link-only\n` +
        `  to provision them, or map them individually when posting:`,
    );
    unmatchedNames.forEach((n) => console.log(`      - ${n}`));
    if (stats.unmatched > unmatchedNames.length) {
      console.log(`      … and ${stats.unmatched - unmatchedNames.length} more`);
    }
  }

  await connection.close();
}

main().catch((error) => {
  console.error('FATAL', error instanceof Error ? error.message : error);
  process.exit(1);
});
