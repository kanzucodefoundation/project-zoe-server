/**
 * import-whm-pga.ts
 * -----------------
 * Reads data/outputs/pga_weekly_data.json (produced by extract_pga_data.py)
 * and creates ReportSubmission rows on the "Sunday Service Report" for
 * every (location, week) pair in the file.
 *
 * Idempotent: skips any (report, group, reportingPeriod) that already exists.
 *
 * Run:
 *   npm run import:whm:pga
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { Connection } from 'typeorm';
import { Report } from '../reports/entities/report.entity';
import { ReportSubmission } from '../reports/entities/report.submission.entity';
import Group from '../groups/entities/group.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

const DATA_FILE = path.join(
  __dirname,
  '../../data/outputs/pga_weekly_data.json',
);

interface PgaRecord {
  locationCode: string;
  weekDate: string; // YYYY-MM-DD
  pga: number;
}

interface DataFile {
  recordCount: number;
  locationCount: number;
  weekCount: number;
  records: PgaRecord[];
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error('Run: python3 data/scripts/extract_pga_data.py first');
    process.exit(1);
  }

  const raw: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  Logger.log(
    `Loaded ${raw.recordCount} records | ${raw.locationCount} locations | ${raw.weekCount} weeks`,
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const conn = app.get(Connection);

  const tenantRepo = conn.getRepository(Tenant);
  const reportRepo = conn.getRepository(Report);
  const groupRepo = conn.getRepository(Group);
  const submissionRepo = conn.getRepository(ReportSubmission);
  const userRepo = conn.getRepository(User);

  // Resolve tenant
  const tenant = await tenantRepo.findOne({
    where: { name: 'worshipharvest' },
  });
  if (!tenant) {
    Logger.error('WHM tenant not found. Run seed:comprehensive first.');
    await app.close();
    process.exit(1);
  }

  // Resolve report
  const report = await reportRepo.findOne({
    where: { name: 'Sunday Service Report', tenant: { id: tenant.id } },
  });
  if (!report) {
    Logger.error(
      'Sunday Service Report not found. Run seed:whm:reports first.',
    );
    await app.close();
    process.exit(1);
  }

  // Resolve the WHM admin user who owns these imported submissions
  const adminUser = await userRepo.findOne({
    where: { username: 'admin@worshipharvest.org' },
  });
  if (!adminUser) {
    Logger.error('WHM admin user not found. Run seed:reset first.');
    await app.close();
    process.exit(1);
  }

  // Build location code → group map (all locations for this tenant)
  const allLocations = await groupRepo
    .createQueryBuilder('g')
    .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
    .andWhere('g."metaData"->>\'code\' IS NOT NULL')
    .getMany();

  const locationByCode = new Map<string, Group>();
  for (const loc of allLocations) {
    const code = loc.metaData?.code as string | undefined;
    if (code) locationByCode.set(code, loc);
  }
  Logger.log(`Found ${locationByCode.size} seeded locations with codes`);

  // Build existing (reportId, groupId, reportingPeriod) set for fast dedup
  const existingKeys = new Set<string>();
  const existing = await submissionRepo
    .createQueryBuilder('s')
    .where('s."reportId" = :reportId', { reportId: report.id })
    .andWhere('s."reportingPeriod" IS NOT NULL')
    .select(['s."groupId"', 's."reportingPeriod"'])
    .getRawMany();

  for (const row of existing) {
    existingKeys.add(`${row['s_groupId']}::${row['s_reportingPeriod']}`);
  }
  Logger.log(`${existingKeys.size} submissions already exist — will skip`);

  // Import
  let created = 0;
  let skipped = 0;
  let noGroup = 0;
  const BATCH = 200;
  const toInsert: Partial<ReportSubmission>[] = [];

  const flush = async () => {
    if (toInsert.length === 0) return;
    await submissionRepo.save(toInsert as ReportSubmission[]);
    created += toInsert.length;
    toInsert.length = 0;
  };

  for (const rec of raw.records) {
    const group = locationByCode.get(rec.locationCode);
    if (!group) {
      noGroup++;
      continue;
    }

    const dedupKey = `${group.id}::${rec.weekDate}`;
    if (existingKeys.has(dedupKey)) {
      skipped++;
      continue;
    }

    toInsert.push({
      report,
      group,
      user: adminUser,
      reportingPeriod: rec.weekDate,
      data: { pga: rec.pga },
    });
    existingKeys.add(dedupKey); // prevent duplicates within this run

    if (toInsert.length >= BATCH) await flush();
  }
  await flush();

  Logger.log('─────────────────────────────────────');
  Logger.log(`Created : ${created}`);
  Logger.log(`Skipped : ${skipped} (already existed)`);
  Logger.log(`No group: ${noGroup} (location not seeded)`);
  Logger.log('✅ PGA import complete');

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
