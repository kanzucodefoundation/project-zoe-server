/**
 * sync-prod-to-sandbox.ts
 *
 * One-time migration: pulls ALL entities from production QBO (read-only) and
 * mirrors them into the QBO sandbox, then writes ExternalSystemMapping rows
 * pointing at sandbox IDs. Supersedes seed-qbo-sandbox.ts and
 * sync-prod-qbo-customers-to-sandbox.ts.
 *
 * Covers: bank accounts, income accounts, departments (locations),
 * classes (FOBs), items (giving categories), campus customers, person customers.
 *
 * Production QBO is STRICTLY READ-ONLY. No HTTP writes are issued against the
 * production base URL. Refreshed production tokens are written back to .env.prod
 * only — never to the DB.
 *
 * Prerequisites:
 *   1. Run export-prod-qbo-credentials.ts to populate .env.prod
 *   2. Set QUICKBOOKS_ENVIRONMENT=sandbox in .env
 *   3. Connect the sandbox company via Settings → QuickBooks in the app
 *      (this stores sandbox credentials in the DB for SEED_TENANT_ID)
 *   4. .env must have:
 *        SEED_TENANT_ID=...
 *        QUICKBOOKS_CLIENT_ID=<sandbox app client ID>
 *        QUICKBOOKS_CLIENT_SECRET=<sandbox app client secret>
 *        DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 *
 * Run:
 *   npm run sync:prod-to-sandbox -- --dry-run
 *   npm run sync:prod-to-sandbox
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Repository } from 'typeorm';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from '../src/integrations/quickbooks/entities/external-system-mapping.entity';
import Contact from '../src/crm/entities/contact.entity';
import Person from '../src/crm/entities/person.entity';
import Phone from '../src/crm/entities/phone.entity';
import Email from '../src/crm/entities/email.entity';
import Group from '../src/groups/entities/group.entity';
import GroupMembership from '../src/groups/entities/groupMembership.entity';
import FinancialAccount from '../src/finance/entities/financial-account.entity';
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

// Zoe giving category keys → QBO item names.
// These are business configuration — not derived from production data.
const GIVING_CATEGORY_MAP: Record<string, string> = {
  TITHE: 'Tithes',
  OFFERING: 'Offertory - Main Garage',
  DONATION: 'Donations',
  ARISE_BUILD: 'Arise and Build',
};

// ─── Production token management ─────────────────────────────────────────────
// Always refresh on startup — the token in .env.prod may be hours old.

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
      'Missing production QBO credentials.\n' +
        'Run export-prod-qbo-credentials.ts first to populate .env.prod.\n' +
        'Required: PROD_QBO_CLIENT_ID, PROD_QBO_CLIENT_SECRET, ' +
        'PROD_QBO_REFRESH_TOKEN, PROD_QBO_REALM_ID',
    );
  }

  console.log('Refreshing production QBO access token...');
  const { data } = await axios.post(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`,
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  if (fs.existsSync(PROD_ENV_FILE)) {
    let content = fs.readFileSync(PROD_ENV_FILE, 'utf8');
    content = content
      .replace(
        /^PROD_QBO_ACCESS_TOKEN=.*/m,
        `PROD_QBO_ACCESS_TOKEN=${data.access_token}`,
      )
      .replace(
        /^PROD_QBO_REFRESH_TOKEN=.*/m,
        `PROD_QBO_REFRESH_TOKEN=${data.refresh_token}`,
      );
    fs.writeFileSync(PROD_ENV_FILE, content, 'utf8');
    console.log('  ✓ Refreshed production tokens written back to .env.prod');
  }

  return { accessToken: data.access_token, realmId };
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
      `No QBO connection found in DB for tenant ${TENANT_ID}.\n` +
        'Connect the sandbox company via Settings → QuickBooks in the app first.',
    );
  }

  if (rec.environment !== 'sandbox') {
    throw new Error(
      `DB connection environment is "${rec.environment}", expected "sandbox".\n` +
        'Run export-prod-qbo-credentials.ts first, then reconnect the app\n' +
        'with QUICKBOOKS_ENVIRONMENT=sandbox in .env.',
    );
  }

  if (rec.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log('Refreshing sandbox QBO access token...');
    try {
      const { data } = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: rec.refreshToken,
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`,
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      rec.accessToken = data.access_token;
      rec.refreshToken = data.refresh_token;
      rec.accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
      await connRepo.save(rec);
      console.log('  ✓ Sandbox token refreshed and saved to DB');
    } catch (err: any) {
      const detail = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
      throw new Error(
        `Sandbox token refresh failed (${
          err?.response?.status ?? 'network error'
        }): ${detail}\n` +
          'Fix: reconnect the sandbox company via Settings → QuickBooks in the staging app,\n' +
          'then re-run the script. The sandbox OAuth connection must be made from the same\n' +
          'app whose QUICKBOOKS_CLIENT_ID/SECRET are in the staging .env.',
      );
    }
  }

  return { accessToken: rec.accessToken, realmId: rec.realmId };
}

// ─── Production QBO — GET only. There is intentionally no postToProd(). ──────

async function fetchAllProd<T>(
  entity: string,
  accessToken: string,
  realmId: string,
  where = 'Active = true',
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  for (let start = 1; ; start += pageSize) {
    const { data } = await axios.get(
      `${PROD_BASE}/v3/company/${realmId}/query`,
      {
        params: {
          query: `SELECT * FROM ${entity} WHERE ${where} STARTPOSITION ${start} MAXRESULTS ${pageSize}`,
          minorversion: MINOR_VERSION,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    const qr = data?.QueryResponse ?? {};
    const page = (Object.values(qr).find(Array.isArray) as T[]) ?? [];
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

// ─── Sandbox QBO — read + write ───────────────────────────────────────────────

async function fetchAllSandbox<T>(
  entity: string,
  accessToken: string,
  realmId: string,
  where = 'Active = true',
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  for (let start = 1; ; start += pageSize) {
    const { data } = await axios.get(
      `${SANDBOX_BASE}/v3/company/${realmId}/query`,
      {
        params: {
          query: `SELECT * FROM ${entity} WHERE ${where} STARTPOSITION ${start} MAXRESULTS ${pageSize}`,
          minorversion: MINOR_VERSION,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    const qr = data?.QueryResponse ?? {};
    const page = (Object.values(qr).find(Array.isArray) as T[]) ?? [];
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

async function postToSandbox(
  endpoint: string,
  body: any,
  accessToken: string,
  realmId: string,
): Promise<any> {
  try {
    const { data } = await axios.post(
      `${SANDBOX_BASE}/v3/company/${realmId}${endpoint}?minorversion=${MINOR_VERSION}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
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

const normalize = (v: string) =>
  (v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const digitsOnly = (v?: string | null) => (v ?? '').replace(/\D/g, '');

function matchFinancialAccount(
  qboName: string,
  zoeAccounts: FinancialAccount[],
): FinancialAccount | null {
  const qNorm = normalize(qboName);
  for (const a of zoeAccounts) {
    const zNorm = normalize(a.name);
    // Zoe name appears within the QBO name (e.g. "WHKLRO" in "WHKLRO Absa Bank AC")
    if (zNorm.length >= 4 && qNorm.includes(zNorm)) return a;
    // QBO name appears within the Zoe name
    if (qNorm.length >= 4 && zNorm.includes(qNorm)) return a;
  }
  return null;
}

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

function inferGender(customer: any): Gender | null {
  const title = String(customer.Title ?? '')
    .toLowerCase()
    .replace(/\./g, '');
  if (title === 'mr' || title === 'sir') return Gender.Male;
  if (['mrs', 'ms', 'miss', 'madam'].includes(title)) return Gender.Female;
  return null;
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
  const fromStepIdx = args.findIndex((a) => a === '--from-step');
  const fromStep =
    fromStepIdx !== -1 ? parseInt(args[fromStepIdx + 1], 10) || 1 : 1;

  const connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const groupRepo = connection.getRepository(Group);
  const accountRepo = connection.getRepository(FinancialAccount);
  const contactRepo = connection.getRepository(Contact);
  const personRepo = connection.getRepository(Person);
  const phoneRepo = connection.getRepository(Phone);
  const emailRepo = connection.getRepository(Email);
  const membershipRepo = connection.getRepository(GroupMembership);

  const [
    { accessToken: prodToken, realmId: prodRealm },
    { accessToken: initialSbToken, realmId: sbRealm },
  ] = await Promise.all([getProdTokens(), getSandboxTokens(connRepo)]);
  let sbToken = initialSbToken;

  console.log(`\nProduction realm : ${prodRealm}`);
  console.log(`Sandbox realm    : ${sbRealm}`);
  if (dryRun) console.log('\nDRY RUN — nothing will be written.');
  if (fromStep > 1)
    console.log(
      `Resuming from step ${fromStep} — steps 1–${fromStep - 1} skipped.\n`,
    );

  // ── Pull everything from production (in parallel) ─────────────────────────
  console.log('\nPulling data from production QBO (read-only)...');
  const [
    prodBankAccounts,
    prodDepartments,
    prodClasses,
    prodItems,
    prodCustomers,
  ] = await Promise.all([
    fetchAllProd<any>(
      'Account',
      prodToken,
      prodRealm,
      "Active = true AND AccountType = 'Bank'",
    ),
    fetchAllProd<any>('Department', prodToken, prodRealm),
    fetchAllProd<any>('Class', prodToken, prodRealm),
    fetchAllProd<any>('Item', prodToken, prodRealm),
    fetchAllProd<any>('Customer', prodToken, prodRealm),
  ]);

  // Collect unique income account names referenced by items.
  // Expense-only items (Bad Debt, etc.) are not giving items and are skipped.
  const incomeAccountNames = new Set<string>();
  for (const item of prodItems) {
    if (item.IncomeAccountRef?.name)
      incomeAccountNames.add(item.IncomeAccountRef.name);
  }

  const incomeItems = prodItems.filter((i) => i.IncomeAccountRef?.name);

  console.log(`  Bank accounts  : ${prodBankAccounts.length}`);
  console.log(`  Departments    : ${prodDepartments.length}`);
  console.log(`  Classes        : ${prodClasses.length}`);
  console.log(
    `  Items          : ${prodItems.length} (${incomeItems.length} income, ${
      prodItems.length - incomeItems.length
    } expense-only — skipped)`,
  );
  console.log(`  Customers      : ${prodCustomers.length}`);
  console.log(
    `  Income accounts: ${incomeAccountNames.size} (referenced by items)`,
  );

  // ── Load Zoe staging data ─────────────────────────────────────────────────
  const [zoeGroups, zoeFinancialAccounts] = await Promise.all([
    groupRepo.find({
      where: { tenant: { id: TENANT_ID } },
      relations: ['category'],
    }),
    accountRepo.find({ where: { tenant: { id: TENANT_ID } } }),
  ]);

  const locationByName = new Map<string, Group>();
  const groupByName = new Map<string, Group>();
  for (const g of zoeGroups) {
    groupByName.set(normalize(g.name), g);
    if (g.category?.purpose === GroupCategoryPurpose.LOCATION) {
      locationByName.set(normalize(g.name), g);
    }
  }
  console.log(
    `\nZoe: ${zoeGroups.length} groups (${locationByName.size} locations), ` +
      `${zoeFinancialAccounts.length} financial accounts`,
  );

  // ── Load existing sandbox entities for idempotency (in parallel) ──────────
  console.log('\nFetching existing sandbox entities...');
  const [sbAccounts, sbDepts, sbClasses, sbItems, sbCustomers] =
    await Promise.all([
      fetchAllSandbox<any>('Account', sbToken, sbRealm),
      fetchAllSandbox<any>('Department', sbToken, sbRealm),
      fetchAllSandbox<any>('Class', sbToken, sbRealm),
      fetchAllSandbox<any>('Item', sbToken, sbRealm),
      fetchAllSandbox<any>('Customer', sbToken, sbRealm),
    ]);

  const sbAccountsByName = new Map<string, any>(
    sbAccounts.map((a) => [normalize(a.Name), a]),
  );
  const sbDeptsByName = new Map<string, any>(
    sbDepts.map((d) => [normalize(d.Name), d]),
  );
  const sbClassesByName = new Map<string, any>(
    sbClasses.map((c) => [normalize(c.Name), c]),
  );
  const sbItemsByName = new Map<string, any>(
    sbItems.map((i) => [normalize(i.Name), i]),
  );
  const sbCustomersByName = new Map<string, any>(
    sbCustomers.map((c) => [normalize(c.DisplayName ?? ''), c]),
  );

  console.log(
    `  ${sbAccounts.length} accounts, ${sbDepts.length} depts, ${sbClasses.length} classes, ` +
      `${sbItems.length} items, ${sbCustomers.length} customers`,
  );

  const stats = {
    incomeCreated: 0,
    bankCreated: 0,
    bankSkipped: 0,
    bankUnmapped: 0,
    deptCreated: 0,
    deptSkipped: 0,
    classCreated: 0,
    classSkipped: 0,
    classFailed: 0,
    itemCreated: 0,
    itemSkipped: 0,
    campusCreated: 0,
    campusSkipped: 0,
    personCreated: 0,
    personSkipped: 0,
    personFailed: 0,
    contactMatched: 0,
    contactCreated: 0,
    noParent: 0,
    alreadyMapped: 0,
  };

  // ── Step 1: Income accounts (items reference these) ─────────────────────────
  const sbIncomeIdByName = new Map<string, string>();
  if (fromStep <= 1) {
    console.log('\nStep 1: Income accounts...');
    for (const name of incomeAccountNames) {
      const existing = sbAccountsByName.get(normalize(name));
      if (existing) {
        sbIncomeIdByName.set(name, String(existing.Id));
        console.log(`  ✓ ${name} (Id=${existing.Id})`);
      } else if (!dryRun) {
        const res = await postToSandbox(
          '/account',
          {
            Name: name,
            AccountType: 'Income',
            AccountSubType: 'ServiceFeeIncome',
            CurrencyRef: { value: 'UGX' },
          },
          sbToken,
          sbRealm,
        );
        const sbId = String(res.Account.Id);
        sbIncomeIdByName.set(name, sbId);
        sbAccountsByName.set(normalize(name), res.Account);
        stats.incomeCreated++;
        console.log(`  + Created ${name} (Id=${sbId})`);
      } else {
        sbIncomeIdByName.set(name, 'DRY_RUN');
        stats.incomeCreated++;
        console.log(`  ~ ${name} (dry run)`);
      }
    }
  } else {
    // Still populate the map from sandbox data so Step 5 can reference income IDs
    for (const name of incomeAccountNames) {
      const existing = sbAccountsByName.get(normalize(name));
      if (existing) sbIncomeIdByName.set(name, String(existing.Id));
    }
    console.log(
      `\nStep 1: skipped (${incomeAccountNames.size} income accounts already in sandbox)`,
    );
  }

  // ── Step 2: Bank accounts ─────────────────────────────────────────────────
  if (fromStep > 2) {
    console.log(`\nStep 2: skipped (${prodBankAccounts.length} bank accounts)`);
  } else {
    console.log('\nStep 2: Bank accounts...');
    for (const account of prodBankAccounts) {
      const name: string = account.Name;
      const existing = sbAccountsByName.get(normalize(name));
      let sbId: string;

      if (existing) {
        sbId = String(existing.Id);
        stats.bankSkipped++;
      } else if (!dryRun) {
        const res = await postToSandbox(
          '/account',
          {
            Name: name,
            AccountType: 'Bank',
            AccountSubType: 'Checking',
            CurrencyRef: { value: 'UGX' },
          },
          sbToken,
          sbRealm,
        );
        sbId = String(res.Account.Id);
        sbAccountsByName.set(normalize(name), res.Account);
        stats.bankCreated++;
        console.log(`  + ${name} (Id=${sbId})`);
      } else {
        sbId = 'DRY_RUN';
        stats.bankCreated++;
      }

      const zoeAccount = matchFinancialAccount(name, zoeFinancialAccounts);
      if (zoeAccount && !dryRun) {
        await upsertMapping(mappingRepo, {
          internalReferenceType: 'FINANCIAL_ACCOUNT',
          internalReferenceId: zoeAccount.id,
          externalReferenceType: 'ACCOUNT',
          externalReferenceId: sbId,
          externalReferenceName: name,
        });
      } else if (!zoeAccount) {
        stats.bankUnmapped++;
        console.log(`  ~ No Zoe FinancialAccount matched: "${name}"`);
      }
    }
    console.log(
      `  → Created ${stats.bankCreated}, skipped ${stats.bankSkipped}, unmatched ${stats.bankUnmapped}`,
    );
  } // end fromStep <= 2

  // ── Step 3: Departments / Locations ──────────────────────────────────────
  if (fromStep > 3) {
    console.log(`\nStep 3: skipped (${prodDepartments.length} departments)`);
  } else {
    console.log('\nStep 3: Departments / Locations...');
    for (const dept of prodDepartments) {
      const name: string = dept.Name;
      const existing = sbDeptsByName.get(normalize(name));
      let sbId: string;

      if (existing) {
        sbId = String(existing.Id);
        stats.deptSkipped++;
      } else if (!dryRun) {
        const res = await postToSandbox(
          '/department',
          { Name: name },
          sbToken,
          sbRealm,
        );
        sbId = String(res.Department.Id);
        sbDeptsByName.set(normalize(name), res.Department);
        stats.deptCreated++;
        console.log(`  + ${name}`);
      } else {
        sbId = 'DRY_RUN';
        stats.deptCreated++;
      }

      const zoeGroup = locationByName.get(normalize(name));
      if (zoeGroup && !dryRun) {
        await upsertMapping(mappingRepo, {
          internalReferenceType: 'GROUP',
          internalReferenceId: zoeGroup.id,
          externalReferenceType: 'LOCATION',
          externalReferenceId: sbId,
          externalReferenceName: name,
        });
      }
    }
    console.log(
      `  → Created ${stats.deptCreated}, skipped ${stats.deptSkipped}`,
    );
  } // end fromStep <= 3

  // ── Step 4: Classes / FOBs ────────────────────────────────────────────────
  if (fromStep > 4) {
    console.log(`\nStep 4: skipped (${prodClasses.length} classes)`);
  } else {
    console.log('\nStep 4: Classes / FOBs...');
    for (const cls of prodClasses) {
      const name: string = cls.Name;
      const existing = sbClassesByName.get(normalize(name));
      let sbId: string | undefined;

      if (existing) {
        sbId = String(existing.Id);
        stats.classSkipped++;
      } else if (!dryRun) {
        try {
          const res = await postToSandbox(
            '/class',
            { Name: name },
            sbToken,
            sbRealm,
          );
          sbId = String(res.Class.Id);
          sbClassesByName.set(normalize(name), res.Class);
          stats.classCreated++;
        } catch (err: any) {
          console.log(`  ✗ "${name}": ${err.message}`);
          stats.classFailed++;
          continue;
        }
      } else {
        sbId = 'DRY_RUN';
        stats.classCreated++;
      }

      if (sbId) {
        const zoeGroup = groupByName.get(normalize(name));
        if (zoeGroup && !dryRun) {
          await upsertMapping(mappingRepo, {
            internalReferenceType: 'GROUP',
            internalReferenceId: zoeGroup.id,
            externalReferenceType: 'CLASS',
            externalReferenceId: sbId,
            externalReferenceName: name,
          });
        }
      }
    }
    console.log(
      `  → Created ${stats.classCreated}, skipped ${stats.classSkipped}, failed ${stats.classFailed}`,
    );
  } // end fromStep <= 4

  // ── Step 5: Items / giving categories ────────────────────────────────────
  if (fromStep > 5) {
    console.log(`\nStep 5: skipped (${incomeItems.length} income items)`);
  } else {
    console.log('\nStep 5: Items (income items only)...');
    const sbItemIdByName = new Map<string, string>();

    for (const item of incomeItems) {
      const name: string = item.Name;
      const existing = sbItemsByName.get(normalize(name));
      let sbId: string;

      if (existing) {
        sbId = String(existing.Id);
        sbItemIdByName.set(name, sbId);
        stats.itemSkipped++;
      } else if (!dryRun) {
        const sbIncomeId =
          sbIncomeIdByName.get(item.IncomeAccountRef.name) ?? '';
        const res = await postToSandbox(
          '/item',
          {
            Name: name,
            Type: item.Type ?? 'Service',
            IncomeAccountRef: { value: sbIncomeId },
            ...(item.Sku ? { Sku: item.Sku } : {}),
          },
          sbToken,
          sbRealm,
        );
        sbId = String(res.Item.Id);
        sbItemsByName.set(normalize(name), res.Item);
        sbItemIdByName.set(name, sbId);
        stats.itemCreated++;
        console.log(`  + ${name} (Id=${sbId})`);
      } else {
        sbId = 'DRY_RUN';
        sbItemIdByName.set(name, sbId);
        stats.itemCreated++;
      }
    }

    for (const [categoryKey, itemName] of Object.entries(GIVING_CATEGORY_MAP)) {
      const sbItemId = sbItemIdByName.get(itemName);
      if (!sbItemId || dryRun) {
        if (!sbItemIdByName.has(itemName)) {
          console.log(
            `  ! GIVING_CATEGORY "${categoryKey}" → item "${itemName}" not found in production`,
          );
        }
        continue;
      }
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GIVING_CATEGORY',
        internalReferenceId: categoryKey,
        externalReferenceType: 'ITEM',
        externalReferenceId: sbItemId,
        externalReferenceName: itemName,
      });
    }
    console.log(
      `  → Created ${stats.itemCreated}, skipped ${stats.itemSkipped}`,
    );
  } // end fromStep <= 5

  // ── Step 6: Campus customers ──────────────────────────────────────────────
  // Production customers whose DisplayName matches a Zoe Location group.
  // campusProdToSandbox is always rebuilt (needed by Step 7) even when skipping.
  const prodCampusIds = new Set<string>();
  const campusProdToSandbox = new Map<string, string>(); // prod ID → sandbox ID

  if (fromStep > 6) {
    console.log(
      '\nStep 6: skipped — rebuilding campus map from sandbox data...',
    );
    for (const c of prodCustomers) {
      const zoeGroup = locationByName.get(normalize(c.DisplayName ?? ''));
      if (!zoeGroup) continue;
      prodCampusIds.add(String(c.Id));
      const existing = sbCustomersByName.get(normalize(c.DisplayName ?? ''));
      if (existing) campusProdToSandbox.set(String(c.Id), String(existing.Id));
    }
    console.log(
      `  → ${campusProdToSandbox.size} campus entries resolved from sandbox`,
    );
  } else {
    console.log('\nStep 6: Campus customers...');
    for (const c of prodCustomers) {
      const zoeGroup = locationByName.get(normalize(c.DisplayName ?? ''));
      if (!zoeGroup) continue;

      prodCampusIds.add(String(c.Id));
      const displayName: string = c.DisplayName;
      const existing = sbCustomersByName.get(normalize(displayName));
      let sbId: string;

      if (existing) {
        sbId = String(existing.Id);
        stats.campusSkipped++;
      } else if (!dryRun) {
        const res = await postToSandbox(
          '/customer',
          { DisplayName: displayName, CompanyName: displayName },
          sbToken,
          sbRealm,
        );
        sbId = String(res.Customer.Id);
        sbCustomersByName.set(normalize(displayName), res.Customer);
        stats.campusCreated++;
        console.log(`  + ${displayName} (Id=${sbId})`);
      } else {
        sbId = 'DRY_RUN';
        stats.campusCreated++;
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
    console.log(
      `  → Created ${stats.campusCreated}, skipped ${stats.campusSkipped}`,
    );
  }

  // ── Step 7: Person customers ──────────────────────────────────────────────
  console.log('\nStep 7: Person customers...');
  const prodById = new Map<string, any>(
    prodCustomers.map((c) => [String(c.Id), c]),
  );

  const personCustomers = prodCustomers.filter(
    (c) => !prodCampusIds.has(String(c.Id)),
  );
  console.log(`  ${personCustomers.length} person customers to process`);
  let personIdx = 0;

  for (const c of personCustomers) {
    personIdx++;
    if (personIdx % 500 === 0 || personIdx === personCustomers.length) {
      console.log(`  [${personIdx}/${personCustomers.length}] processed...`);
      // Refresh sandbox token proactively — access tokens expire after 60 min
      // and this loop can run for several hours.
      const refreshed = await getSandboxTokens(connRepo);
      sbToken = refreshed.accessToken;
    }

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
    const gender = inferGender(c);

    let sbId: string;
    const existing = sbCustomersByName.get(normalize(displayName));
    if (existing) {
      sbId = String(existing.Id);
      stats.personSkipped++;
    } else if (!dryRun) {
      const body: Record<string, any> = {
        DisplayName: displayName,
        ParentRef: { value: sbParentId },
        Job: true,
      };
      if (c.GivenName) body.GivenName = c.GivenName;
      if (c.FamilyName) body.FamilyName = c.FamilyName;
      if (phoneValue) body.PrimaryPhone = { FreeFormNumber: phoneValue };
      if (emailValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))
        body.PrimaryEmailAddr = { Address: emailValue };

      try {
        const res = await postToSandbox('/customer', body, sbToken, sbRealm);
        sbId = String(res.Customer.Id);
        sbCustomersByName.set(normalize(displayName), res.Customer);
        stats.personCreated++;
      } catch (err: any) {
        console.log(`  ✗ "${displayName}": ${err.message}`);
        stats.personFailed++;
        continue;
      }
    } else {
      sbId = 'DRY_RUN';
      stats.personCreated++;
    }

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
  console.log(
    '\n══════════════════════════════════════════════════════════════',
  );
  console.log(dryRun ? 'DRY RUN SUMMARY' : 'SYNC COMPLETE');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Income accounts created          : ${stats.incomeCreated}`);
  console.log(
    `  Bank accounts    created/skipped : ${stats.bankCreated} / ${stats.bankSkipped}  (unmatched to Zoe: ${stats.bankUnmapped})`,
  );
  console.log(
    `  Departments      created/skipped : ${stats.deptCreated} / ${stats.deptSkipped}`,
  );
  console.log(
    `  Classes          created/skipped : ${stats.classCreated} / ${stats.classSkipped}  (failed: ${stats.classFailed})`,
  );
  console.log(
    `  Items            created/skipped : ${stats.itemCreated} / ${stats.itemSkipped}`,
  );
  console.log(
    `  Campus customers created/skipped : ${stats.campusCreated} / ${stats.campusSkipped}`,
  );
  console.log(
    `  Person customers created/skipped : ${stats.personCreated} / ${stats.personSkipped}  (failed: ${stats.personFailed})`,
  );
  console.log(
    `  Zoe contacts     matched/created : ${stats.contactMatched} / ${stats.contactCreated}`,
  );
  console.log(`  Skipped (no campus parent)       : ${stats.noParent}`);
  console.log(`  Already mapped, skipped          : ${stats.alreadyMapped}`);
  console.log('══════════════════════════════════════════════════════════════');
  if (!dryRun) {
    console.log('\nSandbox is fully populated. Next:');
    console.log(
      '  - Delete .env.prod (production credentials no longer needed)',
    );
    console.log('  - The sandbox DB connection self-manages from here');
  }
  console.log();

  await connection.close();
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
