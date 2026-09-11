/**
 * seed-qbo-sandbox.ts
 *
 * One-time script: populates the QBO sandbox account with entities mirroring
 * production, and writes ExternalSystemMapping rows into Zoe's DB.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-qbo-sandbox.ts
 *
 * Prerequisites:
 *   - QBO sandbox OAuth connection already stored in Zoe DB for TENANT_ID
 *     (connect via the app's Settings → QuickBooks first if not done)
 *   - TENANT_ID below matches the WHM tenant in your local/staging DB
 *   - .env loaded (DB creds + QUICKBOOKS_CLIENT_ID/SECRET + QUICKBOOKS_ENVIRONMENT=sandbox)
 */

import 'reflect-metadata';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Repository } from 'typeorm';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from '../src/integrations/quickbooks/entities/external-system-mapping.entity';
import Group from '../src/groups/entities/group.entity';
import FinancialAccount from '../src/finance/entities/financial-account.entity';

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────

const TENANT_ID = 1; // WHM tenant — verify in your DB before running
const SYSTEM = 'QUICKBOOKS';
const QBO_BASE = 'https://sandbox-quickbooks.api.intuit.com';
const MINOR_VERSION = 65;

// ─── All 40 Classes / FOBs (from production) ─────────────────────────────────

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

// ─── All 150 Locations / Departments (from production) ───────────────────────

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

// ─── All 12 giving (Y-prefix) Items from production ──────────────────────────

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

// TransactionCategory enum → QBO item name
const CATEGORY_TO_ITEM: Record<string, string> = {
  TITHE: 'Tithes',
  OFFERING: 'Offertory - Main Garage',
  DONATION: 'Donations',
  ARISE_BUILD: 'Arise and Build',
};

// ─── Bank accounts from production QBO (source of truth) ────────────────────
// These mirror the real QBO chart of accounts. Created in sandbox as Bank type.
// zoeNameHint: substring matched against Zoe FinancialAccount.name to create mapping.
// Leave zoeNameHint null for accounts that have no Zoe counterpart yet.

const BANK_ACCOUNTS: Array<{ qboName: string; zoeNameHint: string | null }> = [
  // Top-level accounts (page 1 of production Chart of Accounts)
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
  // A011 sub-accounts (location-specific, page 2 — partial capture)
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
  // TODO: add remaining A011 sub-accounts from production QBO pages 2-3
  //       Re-run script after adding — it is fully idempotent.
];

// ─── Test customers (2 per representative location for testing) ───────────────

const TEST_CUSTOMERS: Array<{
  givenName: string;
  familyName: string;
  locationName: string;
}> = [
  { givenName: 'Alex', familyName: 'Mwangi', locationName: 'WH Sonde' },
  { givenName: 'Grace', familyName: 'Nakato', locationName: 'WH Sonde' },
  { givenName: 'Brian', familyName: 'Otieno', locationName: 'WH Bugolobi' },
  { givenName: 'Sarah', familyName: 'Auma', locationName: 'WH Bugolobi' },
  { givenName: 'David', familyName: 'Kamau', locationName: 'WH Kira' },
  { givenName: 'Faith', familyName: 'Nandawula', locationName: 'WH Kira' },
  { givenName: 'Peter', familyName: 'Ssemanda', locationName: 'WH Entebbe' },
  { givenName: 'Mary', familyName: 'Akello', locationName: 'WH Entebbe' },
  { givenName: 'John', familyName: 'Mukisa', locationName: 'WH Makerere' },
  { givenName: 'Ruth', familyName: 'Namukasa', locationName: 'WH Makerere' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTokens(connRepo: Repository<ExternalSystemConnection>) {
  const rec = await connRepo.findOne({
    where: { tenantId: TENANT_ID, system: 'quickbooks' },
  });
  if (!rec) {
    throw new Error(
      `No QBO connection found for tenant ${TENANT_ID}.\n` +
        'Connect the sandbox account via the Zoe app first (Settings → QuickBooks → Connect).',
    );
  }

  if (rec.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log('Refreshing QBO access token...');
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
  }

  return { accessToken: rec.accessToken, realmId: rec.realmId };
}

async function qboPost(
  path: string,
  body: any,
  accessToken: string,
  realmId: string,
): Promise<any> {
  const url = `${QBO_BASE}/v3/company/${realmId}${path}?minorversion=${MINOR_VERSION}`;
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
    const detail = err?.response?.data;
    const qboErrors = detail?.Fault?.Error ?? [];
    const msg = qboErrors
      .map((e: any) => `[${e.code}] ${e.Message}: ${e.Detail}`)
      .join('; ');
    throw new Error(
      `QBO POST ${path} failed: ${
        msg || JSON.stringify(detail) || err.message
      }`,
    );
  }
}

async function qboQuery(
  query: string,
  accessToken: string,
  realmId: string,
): Promise<any[]> {
  const url = `${QBO_BASE}/v3/company/${realmId}/query?minorversion=${MINOR_VERSION}`;
  const { data } = await axios.get(url, {
    params: { query },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const qr = data?.QueryResponse ?? {};
  const entities = Object.values(qr).find(Array.isArray);
  return (entities as any[]) ?? [];
}

// Escape single quotes in QBO query strings
function esc(s: string) {
  return s.replace(/'/g, "\\'");
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
  await repo.save(record);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);
  const mappingRepo = connection.getRepository(ExternalSystemMapping);
  const groupRepo = connection.getRepository(Group);
  const accountRepo = connection.getRepository(FinancialAccount);

  const { accessToken, realmId } = await getTokens(connRepo);
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`Seeding QBO sandbox   realmId=${realmId}   tenant=${TENANT_ID}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 1. Income account (items need this ref) ────────────────────────────────
  console.log('Step 1: Ensure income account exists...');
  const existingIncome = await qboQuery(
    "SELECT * FROM Account WHERE Name = 'Giving Income' MAXRESULTS 5",
    accessToken,
    realmId,
  );
  let incomeAccountId: string;
  if (existingIncome.length > 0) {
    incomeAccountId = existingIncome[0].Id;
    console.log(`  ✓ Giving Income already exists (Id=${incomeAccountId})`);
  } else {
    const res = await qboPost(
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
  }

  // ── 2. Bank accounts — mirror production QBO into sandbox ─────────────────
  // QBO is the source of truth. We create the same accounts in sandbox, then
  // map each one to the matching Zoe FinancialAccount (by name hint).
  console.log('\nStep 2: Bank accounts (mirroring production QBO)...');
  const zoeAccounts = await accountRepo.find({
    where: { tenant: { id: TENANT_ID } },
  });
  let bankCreated = 0;
  let bankSkipped = 0;

  for (const ba of BANK_ACCOUNTS) {
    const existing = await qboQuery(
      `SELECT * FROM Account WHERE Name = '${esc(ba.qboName)}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      bankSkipped++;
    } else {
      const res = await qboPost(
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
    }

    if (ba.zoeNameHint) {
      const zoeAccount = zoeAccounts.find((a) =>
        a.name.toLowerCase().includes(ba.zoeNameHint!.toLowerCase()),
      );
      if (zoeAccount) {
        await upsertMapping(mappingRepo, {
          internalReferenceType: 'FINANCIAL_ACCOUNT',
          internalReferenceId: zoeAccount.id,
          externalReferenceType: 'ACCOUNT',
          externalReferenceId: qboId,
          externalReferenceName: ba.qboName,
        });
        console.log(`  ✓ ${ba.qboName} → Zoe "${zoeAccount.name}"`);
      } else {
        console.log(
          `  ~ ${ba.qboName} (no Zoe FinancialAccount matched "${ba.zoeNameHint}")`,
        );
      }
    } else {
      console.log(`  ~ ${ba.qboName} (no Zoe mapping configured)`);
    }
  }
  console.log(`  → Created ${bankCreated}, already existed ${bankSkipped}`);

  // ── 3. Departments / Locations (all) ─────────────────────────────────────
  console.log('\nStep 3: Departments / Locations...');
  let deptCreated = 0;
  let deptSkipped = 0;
  for (const locationName of LOCATIONS) {
    const existing = await qboQuery(
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
    } else {
      const res = await qboPost(
        '/department',
        { Name: locationName },
        accessToken,
        realmId,
      );
      qboId = res.Department.Id;
      deptCreated++;
    }

    const zoeGroup = await groupRepo
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId', { tenantId: TENANT_ID })
      .andWhere('g.name = :name', { name: locationName })
      .getOne();

    if (zoeGroup) {
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

  // ── 4. Classes / FOBs ────────────────────────────────────────────────────
  // Fetch all existing classes first, then create any that are missing.
  // Creation failures (e.g. plan limits) are logged but don't abort the script.
  console.log('\nStep 4: Classes / FOBs...');
  const allClasses = await qboQuery(
    'SELECT * FROM Class WHERE Active = true MAXRESULTS 1000',
    accessToken,
    realmId,
  );
  const classByName = new Map<string, string>(
    allClasses.map((c: any) => [c.Name as string, c.Id as string]),
  );
  console.log(`  Found ${allClasses.length} existing Classes in QBO sandbox`);

  let classCreated = 0;
  let classSkipped = 0;
  let classFailed = 0;
  for (const fobName of FOBS) {
    let qboId = classByName.get(fobName);
    if (qboId) {
      classSkipped++;
    } else {
      try {
        const res = await qboPost(
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
    }

    const zoeGroup = await groupRepo
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId', { tenantId: TENANT_ID })
      .andWhere('g.name = :name', { name: fobName })
      .getOne();

    if (zoeGroup) {
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

  // ── 5. Items / giving categories (all 12) ────────────────────────────────
  console.log('\nStep 5: Items / giving categories (12)...');
  const itemIds: Record<string, string> = {};
  for (const item of ITEMS) {
    const existing = await qboQuery(
      `SELECT * FROM Item WHERE Name = '${esc(item.name)}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      console.log(`  ✓ ${item.name} already exists (Id=${qboId})`);
    } else {
      const res = await qboPost(
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
    }
    itemIds[item.name] = qboId;
  }

  // GIVING_CATEGORY → ITEM mappings
  for (const [categoryKey, itemName] of Object.entries(CATEGORY_TO_ITEM)) {
    const qboItemId = itemIds[itemName];
    if (!qboItemId) continue;
    await upsertMapping(mappingRepo, {
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: categoryKey,
      externalReferenceType: 'ITEM',
      externalReferenceId: qboItemId,
      externalReferenceName: itemName,
    });
    console.log(
      `  Mapped GIVING_CATEGORY:${categoryKey} → ${itemName} (Id=${qboItemId})`,
    );
  }

  // ── 6. Test customers ─────────────────────────────────────────────────────
  console.log('\nStep 6: Test customers (10)...');
  const customerResults: Array<{ name: string; qboId: string }> = [];
  for (const c of TEST_CUSTOMERS) {
    const displayName = `${c.givenName} ${c.familyName}`;
    const existing = await qboQuery(
      `SELECT * FROM Customer WHERE DisplayName = '${esc(
        displayName,
      )}' MAXRESULTS 5`,
      accessToken,
      realmId,
    );
    let qboId: string;
    if (existing.length > 0) {
      qboId = existing[0].Id;
      console.log(`  ✓ ${displayName} already exists (Id=${qboId})`);
    } else {
      const res = await qboPost(
        '/customer',
        {
          GivenName: c.givenName,
          FamilyName: c.familyName,
          DisplayName: displayName,
        },
        accessToken,
        realmId,
      );
      qboId = res.Customer.Id;
      console.log(`  + Created ${displayName} (Id=${qboId})`);
    }
    customerResults.push({ name: displayName, qboId });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('Seeding complete.\n');

  console.log('NEXT STEP — upload this CSV via Zoe Contacts → Bulk Upload:');
  console.log(
    '(This creates Contact records and CUSTOMER mappings in one step)\n',
  );
  console.log(
    'First Name,Last Name,Email,Phone,Date of Birth,Gender,District,Country,Tithe Number,QuickBooks Customer ID',
  );
  for (const c of TEST_CUSTOMERS) {
    const result = customerResults.find(
      (r) => r.name === `${c.givenName} ${c.familyName}`,
    );
    console.log(
      `${c.givenName},${c.familyName},,,,,,,,${result?.qboId ?? 'ERROR'}`,
    );
  }
  console.log('\nAll ExternalSystemMapping rows written to DB.');
  console.log('══════════════════════════════════════════════════════════\n');

  await connection.close();
}

main().catch((err) => {
  console.error(
    '\nSeeding failed:',
    err?.response?.data ?? err?.message ?? err,
  );
  process.exit(1);
});
