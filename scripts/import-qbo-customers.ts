/**
 * import-qbo-customers.ts
 *
 * One-time import in the opposite direction to `seed-qbo-sandbox.ts`: it reads
 * the customers that already exist in QuickBooks and creates the matching
 * people in Project Zoe, mapped and placed.
 *
 * Production already holds every giver as a QuickBooks customer, so running
 * this once removes the need to map records by hand during reconciliation. Only
 * people who appear in an uploaded statement but were never in QuickBooks
 * should still need the manual path in the posting dialog.
 *
 * For each QuickBooks customer it ensures:
 *   - a Contact + Person exists in Zoe
 *   - a CONTACT -> CUSTOMER mapping links the two
 *   - the customer's parent (their campus) is mapped GROUP -> CUSTOMER
 *   - the person is a member of that campus's Location group, so their FOB —
 *     and therefore the sales-receipt Class — resolves without further work
 *
 * Run:
 *   npm run import:qbo-customers -- --dry-run     # report only, write nothing
 *   npm run import:qbo-customers
 *   npm run import:qbo-customers -- --default-gender=Female
 *
 * Idempotent: customers already mapped are skipped, so it is safe to re-run
 * after fixing data or adding locations.
 */

import 'reflect-metadata';
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

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const SYSTEM = 'QUICKBOOKS';
const MINOR_VERSION = 65;

const QBO_BASE =
  (process.env.QUICKBOOKS_ENVIRONMENT ?? 'sandbox') === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

// ─── QuickBooks plumbing (mirrors seed-qbo-sandbox.ts) ───────────────────────

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

/** Pages past QuickBooks' 1000-row query ceiling. */
async function fetchAllCustomers(
  accessToken: string,
  realmId: string,
): Promise<any[]> {
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

const normalize = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * QuickBooks has no gender field, so gender is only known when the customer
 * carries a title. `Person.gender` is nullable precisely so the rest can be
 * left unset rather than invented: guessing would stamp a wrong value on real
 * people, which is worse than recording nothing.
 *
 * `--default-gender=Male|Female` overrides this for callers who would rather
 * have a value than a blank.
 */
function inferGender(
  customer: any,
  fallback: Gender | null,
): { gender: Gender | null; known: boolean } {
  const title = String(customer.Title ?? '').toLowerCase().replace(/\./g, '');
  if (title === 'mr' || title === 'sir') {
    return { gender: Gender.Male, known: true };
  }
  if (['mrs', 'ms', 'miss', 'madam'].includes(title)) {
    return { gender: Gender.Female, known: true };
  }
  return { gender: fallback, known: false };
}

/** Splits a DisplayName when QuickBooks carries no given/family name. */
function splitName(customer: any): { first: string; last: string } {
  const given = String(customer.GivenName ?? '').trim();
  const family = String(customer.FamilyName ?? '').trim();
  if (given || family) {
    return { first: given || family, last: family || given };
  }
  const parts = String(customer.DisplayName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { first: 'Unknown', last: 'Unknown' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** A tithe number written into any of the free-text fields QuickBooks offers. */
function findTitheNumber(customer: any): string | null {
  const haystack = [customer.Notes, customer.CompanyName, customer.PrintOnCheckName]
    .filter(Boolean)
    .join(' ');
  const match = haystack.match(/\b([a-z]{2,6}\d{3,6})\b/i);
  return match ? match[1].toUpperCase() : null;
}

const digitsOnly = (value?: string | null): string =>
  (value ?? '').replace(/\D/g, '');

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
  const genderArg = args
    .find((a) => a.startsWith('--default-gender='))
    ?.split('=')[1];
  // Null unless the caller explicitly asks for a default.
  const fallbackGender: Gender | null =
    genderArg?.toLowerCase() === 'female'
      ? Gender.Female
      : genderArg?.toLowerCase() === 'male'
        ? Gender.Male
        : null;

  const connection: Connection = await getConnection();
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const contactRepo = connection.getRepository(Contact);
  const personRepo = connection.getRepository(Person);
  const phoneRepo = connection.getRepository(Phone);
  const emailRepo = connection.getRepository(Email);
  const groupRepo = connection.getRepository(Group);
  const membershipRepo = connection.getRepository(GroupMembership);

  const { accessToken, realmId } = await getTokens(connRepo);
  console.log(`QuickBooks realm ${realmId} (${QBO_BASE.includes('sandbox') ? 'sandbox' : 'production'})`);
  if (dryRun) console.log('\nDRY RUN — nothing will be written.\n');

  const customers = await fetchAllCustomers(accessToken, realmId);
  console.log(`Found ${customers.length} active customers in QuickBooks.`);

  // ── Zoe location groups, keyed by normalised name ──────────────────────────
  const locationGroups = await groupRepo.find({
    where: { tenant: { id: TENANT_ID } },
    relations: ['category'],
  });
  const locationsByName = new Map<string, Group>();
  for (const group of locationGroups) {
    if (group.category?.purpose === GroupCategoryPurpose.LOCATION) {
      locationsByName.set(normalize(group.name), group);
    }
  }
  console.log(`Zoe has ${locationsByName.size} Location groups to match against.`);

  const customersById = new Map<string, any>(
    customers.map((c) => [String(c.Id), c]),
  );

  const stats = {
    campusesMapped: 0,
    campusesUnmatched: [] as string[],
    contactsCreated: 0,
    contactsLinked: 0,
    alreadyMapped: 0,
    membershipsAdded: 0,
    genderGuessed: 0,
    titheNumbers: 0,
    noCampus: 0,
  };

  // ── Pass 1: campuses ───────────────────────────────────────────────────────
  // A customer is treated as a campus when its name matches a Zoe Location
  // group. Everything else is a person.
  const campusCustomerIds = new Set<string>();
  for (const customer of customers) {
    const group = locationsByName.get(normalize(customer.DisplayName ?? ''));
    if (!group) continue;
    campusCustomerIds.add(String(customer.Id));
    if (!dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: group.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: String(customer.Id),
        externalReferenceName: customer.DisplayName,
      });
    }
    stats.campusesMapped++;
  }

  // ── Pass 2: people ─────────────────────────────────────────────────────────
  for (const customer of customers) {
    const qboId = String(customer.Id);
    if (campusCustomerIds.has(qboId)) continue;

    const existingMapping = await mappingRepo.findOne({
      where: {
        tenantId: TENANT_ID,
        system: SYSTEM,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: qboId,
      },
    });
    if (existingMapping) {
      stats.alreadyMapped++;
      continue;
    }

    const { first, last } = splitName(customer);
    const phoneValue =
      customer.PrimaryPhone?.FreeFormNumber ?? customer.Mobile?.FreeFormNumber;
    const emailValue = customer.PrimaryEmailAddr?.Address;
    const titheNumber = findTitheNumber(customer);

    // Reuse an existing person rather than duplicating them: match on phone
    // first, then on full name.
    let contact: Contact | null = null;
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
    if (!contact) {
      const person = await personRepo
        .createQueryBuilder('person')
        .innerJoin('person.contact', 'contact')
        .where('contact.tenantId = :tenantId', { tenantId: TENANT_ID })
        .andWhere('LOWER(person.firstName) = :first', {
          first: first.toLowerCase(),
        })
        .andWhere('LOWER(person.lastName) = :last', { last: last.toLowerCase() })
        .getOne();
      if (person) {
        contact = await contactRepo.findOne({ where: { id: person.contactId } });
      }
    }

    const { gender, known } = inferGender(customer, fallbackGender);
    if (!known) stats.genderGuessed++;
    if (titheNumber) stats.titheNumbers++;

    if (!contact) {
      if (!dryRun) {
        contact = contactRepo.create({
          tenantId: TENANT_ID,
          category: ContactCategory.Person,
          titheNumber,
        });
        contact = await contactRepo.save(contact);

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
              value: String(phoneValue),
              isPrimary: true,
            }),
          );
        }
        if (emailValue) {
          await emailRepo.save(
            emailRepo.create({
              contactId: contact.id,
              value: String(emailValue),
              isPrimary: true,
            }),
          );
        }
      }
      stats.contactsCreated++;
    } else {
      // Existing person: fill in a tithe number we did not have before.
      if (titheNumber && !contact.titheNumber && !dryRun) {
        contact.titheNumber = titheNumber;
        await contactRepo.save(contact);
      }
      stats.contactsLinked++;
    }

    if (!dryRun && contact) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'CONTACT',
        internalReferenceId: contact.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: qboId,
        externalReferenceName: customer.DisplayName,
      });
    }

    // ── Campus membership, from the customer's parent ───────────────────────
    const parentId = customer.ParentRef?.value
      ? String(customer.ParentRef.value)
      : null;
    const parent = parentId ? customersById.get(parentId) : null;
    const campusGroup = parent
      ? locationsByName.get(normalize(parent.DisplayName ?? ''))
      : null;

    if (!campusGroup) {
      stats.noCampus++;
      if (parent && !stats.campusesUnmatched.includes(parent.DisplayName)) {
        stats.campusesUnmatched.push(parent.DisplayName);
      }
      continue;
    }

    if (!dryRun && contact) {
      const existingMembership = await membershipRepo.findOne({
        where: { contactId: contact.id, groupId: campusGroup.id },
      });
      if (!existingMembership) {
        await membershipRepo.save(
          membershipRepo.create({
            contactId: contact.id,
            groupId: campusGroup.id,
            isActive: true,
          }),
        );
        stats.membershipsAdded++;
      }
    } else {
      stats.membershipsAdded++;
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(dryRun ? 'DRY RUN SUMMARY' : 'IMPORT COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`  Campuses mapped to Location groups : ${stats.campusesMapped}`);
  console.log(`  People created                     : ${stats.contactsCreated}`);
  console.log(`  People matched to existing records : ${stats.contactsLinked}`);
  console.log(`  Already mapped, skipped            : ${stats.alreadyMapped}`);
  console.log(`  Campus memberships added           : ${stats.membershipsAdded}`);
  console.log(`  Tithe numbers found                : ${stats.titheNumbers}`);

  if (stats.genderGuessed > 0 && fallbackGender) {
    console.log(
      `\n  ! ${stats.genderGuessed} people had no title in QuickBooks, so gender was\n` +
        `    set to ${fallbackGender} as requested. Correct these in the CRM.`,
    );
  } else if (stats.genderGuessed > 0) {
    console.log(
      `\n  i ${stats.genderGuessed} people had no title in QuickBooks, so their gender was\n` +
        `    left unset rather than guessed.`,
    );
  }
  if (stats.noCampus > 0) {
    console.log(
      `\n  ! ${stats.noCampus} people could not be placed in a campus and will fall\n` +
        `    back to Central when posting.`,
    );
    if (stats.campusesUnmatched.length > 0) {
      console.log(
        `    Parent customers with no matching Zoe Location group:\n` +
          stats.campusesUnmatched
            .slice(0, 20)
            .map((n) => `      - ${n}`)
            .join('\n'),
      );
    }
  }

  await connection.close();
}

main().catch((error) => {
  console.error('FATAL', error instanceof Error ? error.message : error);
  process.exit(1);
});
