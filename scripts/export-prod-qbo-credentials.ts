/**
 * export-prod-qbo-credentials.ts
 *
 * One-time helper: reads the production QBO connection from the Zoe DB and
 * writes the credentials to .env.prod — preserving them before you swap the
 * DB row to sandbox via the app's OAuth flow.
 *
 * Run BEFORE setting QUICKBOOKS_ENVIRONMENT=sandbox in .env and
 * reconnecting via Settings → QuickBooks in the app.
 *
 * Prerequisites:
 *   - Production QBO connection stored in DB for SEED_TENANT_ID
 *   - QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in .env
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/export-prod-qbo-credentials.ts
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { getConnection } from './db.connection';
import { ExternalSystemConnection } from '../src/integrations/quickbooks/entities/external-system-connection.entity';

dotenv.config();

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const PROD_ENV_FILE = path.resolve(process.cwd(), '.env.prod');

async function main() {
  const connection = await getConnection();
  const connRepo = connection.getRepository(ExternalSystemConnection);

  const rec = await connRepo.findOne({
    where: { tenantId: TENANT_ID, system: 'quickbooks' },
  });

  if (!rec) {
    throw new Error(
      `No QBO connection found in DB for tenant ${TENANT_ID}.\n` +
        'Connect via Settings → QuickBooks in the app first.',
    );
  }

  if (rec.environment !== 'production') {
    console.warn(
      `\nWarning: DB connection environment is "${rec.environment}", not "production".\n` +
        'Proceeding anyway — verify the credentials are correct.\n',
    );
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? '';
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET ?? '';

  if (!clientId || !clientSecret) {
    throw new Error(
      'QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET must be set in .env',
    );
  }

  if (fs.existsSync(PROD_ENV_FILE)) {
    const backup = `${PROD_ENV_FILE}.bak`;
    fs.copyFileSync(PROD_ENV_FILE, backup);
    console.log(`Backed up existing .env.prod → ${backup}`);
  }

  const content = [
    `PROD_QBO_CLIENT_ID=${clientId}`,
    `PROD_QBO_CLIENT_SECRET=${clientSecret}`,
    `PROD_QBO_ACCESS_TOKEN=${rec.accessToken}`,
    `PROD_QBO_REFRESH_TOKEN=${rec.refreshToken}`,
    `PROD_QBO_REALM_ID=${rec.realmId}`,
    '',
  ].join('\n');

  fs.writeFileSync(PROD_ENV_FILE, content, 'utf8');

  console.log(`\n✓ Production QBO credentials written to ${PROD_ENV_FILE}`);
  console.log(`  Realm ID    : ${rec.realmId}`);
  console.log(`  Environment : ${rec.environment}`);
  console.log(`  Token expires: ${rec.accessTokenExpiresAt.toISOString()}`);
  console.log('\nNext steps:');
  console.log('  1. Set QUICKBOOKS_ENVIRONMENT=sandbox in .env');
  console.log(
    '  2. Connect the sandbox company via Settings → QuickBooks in the app',
  );
  console.log('  3. Run: npm run sync:prod-to-sandbox -- --dry-run');

  await connection.close();
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
