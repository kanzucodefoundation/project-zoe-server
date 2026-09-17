/**
 * seed-qbo-sandbox.ts
 *
 * Populates the QBO sandbox with the structural entities that mirror production
 * and writes the corresponding ExternalSystemMapping rows into Zoe's DB.
 *
 * Covers everything except individual givers — run sync-prod-qbo-customers-to-sandbox.ts
 * afterwards to mirror real customers from production QBO.
 *
 * Idempotent: existing QBO entities are reused by name, existing mappings are upserted.
 *
 * Prerequisites:
 *   - .env loaded (DB credentials, sandbox QUICKBOOKS_CLIENT_ID/SECRET,
 *     SEED_TENANT_ID, QUICKBOOKS_ENVIRONMENT=sandbox)
 *   - Staging QBO sandbox connection stored in Zoe DB for SEED_TENANT_ID
 *     (connect via Settings → QuickBooks in the app if not done)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-qbo-sandbox.ts
 *   npx ts-node -r tsconfig-paths/register scripts/seed-qbo-sandbox.ts --dry-run
 */

import 'reflect-metadata';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Repository } from 'typeorm';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from '../src/integrations/quickbooks/entities/external-system-mapping.entity';
import Group from '../src/groups/entities/group.entity';
import { GroupCategoryPurpose } from '../src/groups/enums/groups';
import FinancialAccount from '../src/finance/entities/financial-account.entity';

dotenv.config();

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const SYSTEM = 'QUICKBOOKS';
const SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com';
const MINOR_VERSION = 65;

// ─── All Classes / FOBs (from production) ────────────────────────────────────

const FOBS = [
  'Arua FOB',
  'Bugolobi FOB',
  'Bweyogerere FOB',
  'Central',
  'EASTERN REGION',
  'Entebbe FOB',
  'Fort Portal FOB',
  'Gayaza FOB',
  'Global',
  'Gulu FOB',
  'Hoima FOB',
  'Iganga FOB',
  'Jinja FOB',
  'Joggo FOB',
  'Kabbubu FOB',
  'Kajjansi FOB',
  'Kamuli FOB',
  'Kansanga FOB',
  'Kira FOB',
  'Kiti FOB',
  'Kitukutwe FOB',
  'Kungu',
  'Kungu FOB',
  'Makerere FOB',
  'Masaka FOB',
  'Matugga FOB',
  'Mbale FOB',
  'Mbarara FOB',
  'Mpigi FOB',
  'Mukono Central FOB',
  'Mukono FOB',
  'Naalya FOB',
  'Nakawa FOB',
  'Nakawuka FOB',
  'Peculiar',
  'Sentema FOB',
  'Sonde',
  'Sonde FOB',
  'Wairaka FOB',
  'Wakiso FOB',
];

// ─── All Locations / Departments (from production) ───────────────────────────

const LOCATIONS = [
  'WH Abayita',
  'WH Africa Online',
  'WH Apac',
  'WH Arua',
  'WH Arua Airfield',
  'WH Asia Online',
  'WH Australia',
  'WH Bajjo',
  'WH Bermuda',
  'WH Biharwe',
  'WH Bondo',
  'WH Budaka',
  'WH Buddo',
  'WH Budondo',
  'WH Bugembe',
  'WH Bugolobi',
  'WH Bukasa',
  'WH Bukaya',
  'WH Bukerere',
  'WH Bukoto',
  'WH Buliisa',
  'WH Bulindo',
  'WH Buloba',
  'WH Bulondo',
  'WH Bunamwaya',
  'WH Busabala',
  'WH Busega',
  'WH Bushenyi',
  'WH Busiika',
  'WH Busukuma',
  'WH Buwambo',
  'WH Buwaya',
  'WH Buwenge',
  'WH Buziga',
  'WH Bwebajja',
  'WH Bwerenga',
  'WH Bweyogerere',
  'WH Canada',
  'WH Central',
  'WH Daresalaam',
  'WH Downtown',
  'WH Entebbe',
  'WH Entebbe Central',
  'WH Europe Online',
  'WH FortPortal',
  'WH Garuga',
  'WH Gayaza',
  'WH Geneva',
  'WH Germany',
  'WH Ggaba Road',
  'WH Gganda',
  'WH Gomba',
  'WH Gulu',
  'WH Hoima',
  'WH Ibanda',
  'WH Idudi',
  'WH Iganga',
  'WH Iganga CMS',
  'WH Ishaka',
  'WH Jinja',
  'WH Joggo',
  'WH Kabale',
  'WH Kabembe',
  'WH Kabubu',
  'WH Kaihura',
  'WH kajjansi',
  'WH Kakira',
  'WH Kakiri',
  'WH Kakoba',
  'WH Kalagi',
  'WH Kaliro',
  'WH Kamuli',
  'WH Kasaayi',
  'WH Kasanje',
  'WH Kasenge',
  'WH Kasengejje',
  'WH Kasenyi',
  'WH Kasese',
  'WH Kasokoso',
  'WH Kasubi',
  'WH Katende',
  'WH Katete',
  'WH Kavule',
  'WH Kawanda',
  'WH Kawempe',
  'WH Kayunga',
  'WH Kayunga - Wakiso',
  'WH Kibibi',
  'WH Kibinge',
  'WH Kibuli',
  'WH Kibuye',
  'WH Kigumba',
  'WH Kigungu',
  'WH Kijabijjo',
  'WH Kilemezi',
  'WH Kimwanyi',
  'WH Kira',
  'WH Kireku',
  'WH Kirinya',
  'WH Kisaasi',
  'WH Kisoga',
  'WH Kitagobwa',
  'WH Kitende',
  'WH Kiti',
  'WH Kitikifumba',
  'WH Kito-Kisooba',
  'WH Kitukutwe',
  'WH Kiwanga',
  'WH Kiwenda',
  'WH Koboko',
  'WH Kulambiro',
  'WH Kungu',
  'WH Kyabakadde',
  'WH Kyanja',
  'WH Kyebando',
  'WH Kyegegwa',
  'WH Kyengera',
  'WH Kyenjojo',
  'WH Kyetume',
  'WH Kyotera',
  'WH Leeds',
  'WH Lira',
  'WH Lugazi',
  'WH Lugoba',
  'WH Lukaya',
  'WH Lungujja',
  'WH Lusaka',
  'WH Lusanja',
  'WH Lusaze',
  'WH Luton',
  'WH Luuka',
  'WH Luwero',
  'WH Luzira',
  'WH Lyantonde',
  'WH Mafubira',
  'WH Magamaga',
  'WH Maganjo',
  'WH Magere',
  'WH Makerere',
  'WH Makindye',
  'WH Masajja',
  'WH Masaka',
  'WH Masanafu',
  'WH Masindi',
  'WH Masulita',
  'WH Matugga',
  'WH Mawanda Road',
  'WH Maya',
  'WH Mayuge',
];

// ─── Giving items (from production) ──────────────────────────────────────────

const ITEMS = [
  { name: 'Tithes', code: 'Y100' },
  { name: "Offertory - Children's Church", code: 'Y200' },
  { name: 'Offertory - Main Garage', code: 'Y200' },
  { name: 'Offertory - Thanksgiving', code: 'Y200' },
  { name: 'Offertory - YXP', code: 'Y200' },
  { name: 'Firstfruits', code: 'Y300' },
  { name: 'Arise and Build', code: 'Y400' },
  { name: 'Products & Services', code: 'Y500' },
  { name: 'Donations', code: 'Y600' },
  { name: 'Other Income', code: 'Y700' },
  { name: 'Buy The Land', code: 'Y800' },
  { name: 'Investment Income', code: 'Y900' },
];

const CATEGORY_TO_ITEM: Record<string, string> = {
  TITHE: 'Tithes',
  OFFERING: 'Offertory - Main Garage',
  DONATION: 'Donations',
  ARISE_BUILD: 'Arise and Build',
};

// ─── Bank accounts (mirroring production QBO chart of accounts) ───────────────
// zoeNameHint: substring matched against Zoe FinancialAccount.name to create the mapping.
// TODO: add remaining A011 sub-accounts from production QBO pages 2-3 then re-run.

const BANK_ACCOUNTS: Array<{ qboName: string; zoeNameHint: string | null }> = [
  { qboName: 'WHKLRO Absa Bank AC', zoeNameHint: 'WHKLRO' },
  { qboName: 'A001 . Central Fund Absa A/C', zoeNameHint: 'Central Fund' },
  { qboName: 'WHBWNG Absa Bank A/C', zoeNameHint: 'WHBWNG' },
  { qboName: 'WHApac Stanbic Bank Acc', zoeNameHint: 'Apac' },
  { qboName: 'WHNWPD Absa Bank A/C', zoeNameHint: 'WHNWPD' },
  { qboName: 'Joyce Nakalema', zoeNameHint: 'Joyce' },
  { qboName: 'Cash at hand', zoeNameHint: 'Cash at hand' },
  { qboName: 'A0009 Healing Jesus Campaign', zoeNameHint: 'Healing Jesus' },
  { qboName: 'A002 Projects Absa Bank A/C', zoeNameHint: 'Projects' },
  { qboName: 'A003 Welfare Absa Bank A/C', zoeNameHint: 'Welfare' },
  { qboName: 'WHNLYA Absa Bank A/C', zoeNameHint: 'WHNLYA' },
  { qboName: 'WHNMLG Absa Bank A/C', zoeNameHint: 'WHNMLG' },
  { qboName: 'WHNMVE Absa Bank A/C', zoeNameHint: 'WHNMVE' },
  { qboName: 'WHNMWG Absa Bank A/C', zoeNameHint: 'WHNMWG' },
  { qboName: 'WHNRBI Absa A/c', zoeNameHint: 'WHNRBI' },
  { qboName: 'WHNSBY Absa Bank A/C', zoeNameHint: 'WHNSBY' },
  { qboName: 'WHNSNA Absa Bank A/C', zoeNameHint: 'WHNSNA' },
  { qboName: 'WHNSSA Absa Bank A/C', zoeNameHint: 'WHNSSA' },
  { qboName: 'WHNTGM Absa Bank A/C', zoeNameHint: 'WHNTGM' },
  { qboName: 'WHNTTE Absa Bank A/C', zoeNameHint: 'WHNTTE' },
  { qboName: 'WHNYDO Absa Bank A/C', zoeNameHint: 'WHNYDO' },
  { qboName: 'WHNYSA Absa A/C', zoeNameHint: 'WHNYSA' },
  { qboName: 'WHPDHA Absa A/C', zoeNameHint: 'WHPDHA' },
  { qboName: 'WHSEGK Absa Bank A/C', zoeNameHint: 'WHSEGK' },
];

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
        'Connect the sandbox account via the Zoe app first (Settings → QuickBooks → Connect).',
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

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

// ─── Zoe DB helpers ───────────────────────────────────────────────────────────

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

  const connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const groupRepo = connection.getRepository(Group);
  const accountRepo = connection.getRepository(FinancialAccount);

  const { accessToken, realmId } = await getSandboxTokens(connRepo);
  console.log(`\nSandbox realm: ${realmId}   tenant: ${TENANT_ID}`);
  if (dryRun) console.log('\nDRY RUN — nothing will be written.\n');

  // ── Step 1: Income account (items need this ref) ───────────────────────────
  console.log('\nStep 1: Income account...');
  let incomeAccountId: string;
  const existingIncome = await querySandbox<any>(
    "SELECT * FROM Account WHERE Name = 'Giving Income' MAXRESULTS 5",
    accessToken,
    realmId,
  );
  if (existingIncome.length > 0) {
    incomeAccountId = existingIncome[0].Id;
    console.log(`  ✓ Giving Income already exists (Id=${incomeAccountId})`);
  } else if (!dryRun) {
    const res = await postToSandbox(
      '/account',
      {
        Name: 'Giving Income',
        AccountType: 'Income',
        AccountSubType: 'ServiceFeeIncome',
        CurrencyRef: { value: 'UGX' },
      },
      accessToken,
      realmId,
    );
    incomeAccountId = res.Account.Id;
    console.log(`  + Created Giving Income (Id=${incomeAccountId})`);
  } else {
    incomeAccountId = 'DRY_RUN';
  }

  // ── Step 2: Bank accounts ──────────────────────────────────────────────────
  console.log('\nStep 2: Bank accounts...');
  const zoeAccounts = await accountRepo.find({
    where: { tenant: { id: TENANT_ID } },
  });
  let bankCreated = 0;
  let bankSkipped = 0;

  for (const ba of BANK_ACCOUNTS) {
    const existing = await querySandbox<any>(
      `SELECT * FROM Account WHERE Name = '${esc(ba.qboName)}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      bankSkipped++;
    } else if (!dryRun) {
      const res = await postToSandbox(
        '/account',
        {
          Name: ba.qboName,
          AccountType: 'Bank',
          AccountSubType: 'Checking',
          CurrencyRef: { value: 'UGX' },
        },
        accessToken,
        realmId,
      );
      qboId = res.Account.Id;
      bankCreated++;
    } else {
      qboId = 'DRY_RUN';
      bankCreated++;
    }

    if (ba.zoeNameHint) {
      const zoeAccount = zoeAccounts.find((a) =>
        a.name.toLowerCase().includes(ba.zoeNameHint!.toLowerCase()),
      );
      if (zoeAccount && !dryRun) {
        await upsertMapping(mappingRepo, {
          internalReferenceType: 'FINANCIAL_ACCOUNT',
          internalReferenceId: zoeAccount.id,
          externalReferenceType: 'ACCOUNT',
          externalReferenceId: qboId,
          externalReferenceName: ba.qboName,
        });
        console.log(`  ✓ ${ba.qboName} → Zoe "${zoeAccount.name}"`);
      } else if (!zoeAccount) {
        console.log(
          `  ~ ${ba.qboName} (no Zoe FinancialAccount matched "${ba.zoeNameHint}")`,
        );
      }
    }
  }
  console.log(`  → Created ${bankCreated}, already existed ${bankSkipped}`);

  // ── Step 3: Departments / Locations ───────────────────────────────────────
  console.log('\nStep 3: Departments / Locations...');
  let deptCreated = 0;
  let deptSkipped = 0;

  for (const locationName of LOCATIONS) {
    const existing = await querySandbox<any>(
      `SELECT * FROM Department WHERE Name = '${esc(
        locationName,
      )}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      deptSkipped++;
    } else if (!dryRun) {
      const res = await postToSandbox(
        '/department',
        { Name: locationName },
        accessToken,
        realmId,
      );
      qboId = res.Department.Id;
      deptCreated++;
    } else {
      qboId = 'DRY_RUN';
      deptCreated++;
    }

    const zoeGroup = await groupRepo
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId', { tenantId: TENANT_ID })
      .andWhere('g.name = :name', { name: locationName })
      .getOne();

    if (zoeGroup && !dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: zoeGroup.id,
        externalReferenceType: 'LOCATION',
        externalReferenceId: qboId,
        externalReferenceName: locationName,
      });
    }
  }
  console.log(`  → Created ${deptCreated}, already existed ${deptSkipped}`);

  // ── Step 4: Classes / FOBs ─────────────────────────────────────────────────
  console.log('\nStep 4: Classes / FOBs...');
  const allClasses = await querySandbox<any>(
    'SELECT * FROM Class WHERE Active = true MAXRESULTS 1000',
    accessToken,
    realmId,
  );
  const classByName = new Map<string, string>(
    allClasses.map((c: any) => [c.Name as string, c.Id as string]),
  );
  let classCreated = 0;
  let classSkipped = 0;
  let classFailed = 0;

  for (const fobName of FOBS) {
    let qboId = classByName.get(fobName);
    if (qboId) {
      classSkipped++;
    } else if (!dryRun) {
      try {
        const res = await postToSandbox(
          '/class',
          { Name: fobName },
          accessToken,
          realmId,
        );
        qboId = res.Class.Id;
        classCreated++;
      } catch (err: any) {
        console.log(`  ✗ Could not create "${fobName}": ${err.message}`);
        classFailed++;
        continue;
      }
    } else {
      qboId = 'DRY_RUN';
      classCreated++;
    }

    const zoeGroup = await groupRepo
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId', { tenantId: TENANT_ID })
      .andWhere('g.name = :name', { name: fobName })
      .getOne();

    if (zoeGroup && !dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: zoeGroup.id,
        externalReferenceType: 'CLASS',
        externalReferenceId: qboId,
        externalReferenceName: fobName,
      });
    }
  }
  console.log(
    `  → Created ${classCreated}, already existed ${classSkipped}, failed ${classFailed}`,
  );

  // ── Step 5: Items / giving categories ─────────────────────────────────────
  console.log('\nStep 5: Items / giving categories...');
  const itemIds: Record<string, string> = {};

  for (const item of ITEMS) {
    const existing = await querySandbox<any>(
      `SELECT * FROM Item WHERE Name = '${esc(item.name)}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      console.log(`  ✓ ${item.name} already exists (Id=${qboId})`);
    } else if (!dryRun) {
      const res = await postToSandbox(
        '/item',
        {
          Name: item.name,
          Type: 'Service',
          IncomeAccountRef: { value: incomeAccountId },
          Sku: item.code,
        },
        accessToken,
        realmId,
      );
      qboId = res.Item.Id;
      console.log(`  + Created ${item.name} (Id=${qboId})`);
    } else {
      qboId = 'DRY_RUN';
      console.log(`  ~ ${item.name} (dry run)`);
    }
    itemIds[item.name] = qboId;
  }

  for (const [categoryKey, itemName] of Object.entries(CATEGORY_TO_ITEM)) {
    const qboItemId = itemIds[itemName];
    if (!qboItemId || dryRun) continue;
    await upsertMapping(mappingRepo, {
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: categoryKey,
      externalReferenceType: 'ITEM',
      externalReferenceId: qboItemId,
      externalReferenceName: itemName,
    });
  }

  // ── Step 6: Campus customers (from Zoe Location groups) ───────────────────
  // Creates a top-level QBO customer per campus so individual givers can be
  // nested under their location. sync-prod-qbo-customers-to-sandbox.ts will
  // reuse these when creating person customers.
  console.log('\nStep 6: Campus customers...');
  const zoeGroups = await groupRepo.find({
    where: { tenant: { id: TENANT_ID } },
    relations: ['category'],
  });
  const campuses = zoeGroups.filter(
    (g) => g.category?.purpose === GroupCategoryPurpose.LOCATION,
  );

  if (campuses.length === 0) {
    console.log(
      '  ! No Location groups found in Zoe — skipping campus customers.',
    );
  }

  let campusCreated = 0;
  let campusSkipped = 0;

  for (const campus of campuses) {
    const existing = await querySandbox<any>(
      `SELECT * FROM Customer WHERE DisplayName = '${esc(
        campus.name,
      )}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      campusSkipped++;
    } else if (!dryRun) {
      const res = await postToSandbox(
        '/customer',
        { DisplayName: campus.name, CompanyName: campus.name },
        accessToken,
        realmId,
      );
      qboId = res.Customer.Id;
      campusCreated++;
      console.log(`  + ${campus.name} (Id=${qboId})`);
    } else {
      qboId = 'DRY_RUN';
      campusCreated++;
    }

    if (!dryRun) {
      await upsertMapping(mappingRepo, {
        internalReferenceType: 'GROUP',
        internalReferenceId: campus.id,
        externalReferenceType: 'CUSTOMER',
        externalReferenceId: qboId,
        externalReferenceName: campus.name,
      });
    }
  }
  console.log(`  → Created ${campusCreated}, already existed ${campusSkipped}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(dryRun ? 'DRY RUN SUMMARY' : 'SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Run sync-prod-qbo-customers-to-sandbox.ts next to mirror');
  console.log('  real givers from production QBO into the sandbox.');
  console.log('══════════════════════════════════════════════════════════\n');

  await connection.close();
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
