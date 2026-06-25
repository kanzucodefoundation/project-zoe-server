/**
 * Production reset + seed for Worship Harvest.
 *
 * Steps:
 *   1. Clears ALL data (groups, users, contacts, reports, roles, categories)
 *   2. Seeds baseline: tenant → roles → group categories
 *   3. Seeds WHM group tree: Worship Harvest (Movement) → 6 Regions → 37 FOBs → locations
 *   4. Creates your personal admin account (prompted at runtime — nothing hardcoded)
 *
 * Usage:
 *   npm run seed:whm:production
 *   npm run seed:whm:production -- --dry-run   (skip clear; add/update on top of existing data)
 */

import * as readline from 'readline';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ComprehensiveSeedService } from '../seed/comprehensive-seed.service';
import { WhmGroupTreeSeedService } from '../seed/whm/whm-group-tree.seed';
import { Logger } from '@nestjs/common';

async function promptAdminCredentials(): Promise<{
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Create your admin account');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const firstName = await ask('  First name  : ');
  const lastName  = await ask('  Last name   : ');
  const email     = await ask('  Email       : ');
  const password  = await ask('  Password    : ');

  rl.close();
  console.log('');

  if (!firstName || !lastName || !email || !password) {
    throw new Error('All admin fields are required');
  }
  return { firstName, lastName, email, password };
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const skipAdmin = process.argv.includes('--no-admin');

  // Collect admin credentials before starting the app (keeps stdin clean)
  let adminCredentials: Awaited<ReturnType<typeof promptAdminCredentials>> | null = null;
  if (!skipAdmin) {
    adminCredentials = await promptAdminCredentials();
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const comprehensiveSeed = app.get(ComprehensiveSeedService);
  const groupTreeSeed = app.get(WhmGroupTreeSeedService);

  try {
    if (isDryRun) {
      Logger.log('🔍 DRY RUN — skipping clear step');
    } else {
      Logger.log('🧹 Clearing all existing data...');
      await comprehensiveSeed.clearAll();
      Logger.log('✅ Database cleared');
    }

    Logger.log('🏢 Seeding tenant...');
    await comprehensiveSeed.ensureDefaultTenant();

    Logger.log('🔐 Seeding roles...');
    await comprehensiveSeed.seedRoles();

    Logger.log('📂 Seeding group categories...');
    await comprehensiveSeed.seedGroupCategories();

    Logger.log('🌲 Seeding group tree (Movement → Regions → FOBs → Locations)...');
    await groupTreeSeed.seedGroupTree();

    if (adminCredentials) {
      Logger.log('👤 Creating admin account...');
      await comprehensiveSeed.seedAdminUser(adminCredentials);
      await groupTreeSeed.assignAdminToMovement(adminCredentials.email);
    }

    Logger.log('\n✅ Production seed complete.');
    Logger.log('   Worship Harvest → 6 Regions → 37 FOBs → locations');
    if (adminCredentials) {
      Logger.log(`   Admin login: ${adminCredentials.email}`);
    }
  } catch (error) {
    Logger.error('❌ Production seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

run();
