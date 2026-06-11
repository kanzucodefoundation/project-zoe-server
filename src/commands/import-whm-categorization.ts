/**
 * import-whm-categorization.ts
 * -------------------------------
 * Reads data/outputs/whm_categorization.json and populates monthly
 * categorization data on the Monthly Location Categorization report for the
 * full WHM network (Sep 2025 - Mar 2026).
 *
 * Fields imported: grade, rank, pga, mca, mcs, plants, opsInc, fts
 * Fields not in source (skipped): mission, missionLabel, criteriaBreakdown, healthScore
 *
 * Idempotent: skips (group, reportingPeriod) that already have ANY submission
 * for this report — including the Champions-subset rows already imported for
 * Jul-Oct 2025 via import:champions:categorization:2025.
 *
 * Run:
 *   npm run import:whm:categorization
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { Connection } from 'typeorm';
import { Report } from '../reports/entities/report.entity';
import { ReportField } from '../reports/entities/report.field.entity';
import { ReportSubmission } from '../reports/entities/report.submission.entity';
import { ReportSubmissionData } from '../reports/entities/report.submission.data.entity';
import Group from '../groups/entities/group.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

const DATA_FILE = path.join(
  __dirname,
  '../../data/outputs/whm_categorization.json',
);

const IMPORTABLE_FIELDS = [
  'grade',
  'rank',
  'pga',
  'mca',
  'mcs',
  'plants',
  'opsInc',
  'fts',
] as const;

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error(
      'Run: python3 data/scripts/extract_whm_categorization.py first',
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  Logger.log(
    `Loaded ${raw.recordCount} records across ${raw.periodCount} months`,
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const conn = app.get(Connection);

  const tenantRepo = conn.getRepository(Tenant);
  const reportRepo = conn.getRepository(Report);
  const fieldRepo = conn.getRepository(ReportField);
  const groupRepo = conn.getRepository(Group);
  const submissionRepo = conn.getRepository(ReportSubmission);
  const submissionDataRepo = conn.getRepository(ReportSubmissionData);
  const userRepo = conn.getRepository(User);

  const tenant = await tenantRepo.findOne({
    where: { name: 'worshipharvest' },
  });
  if (!tenant) {
    Logger.error('WHM tenant not found.');
    await app.close();
    process.exit(1);
  }

  const report = await reportRepo.findOne({
    where: {
      name: 'Monthly Location Categorization',
      tenant: { id: tenant.id },
    },
  });
  if (!report) {
    Logger.error(
      'Monthly Location Categorization report not found. Run seed:whm:reports first.',
    );
    await app.close();
    process.exit(1);
  }

  const fieldMap = new Map<string, ReportField>();
  for (const fieldName of IMPORTABLE_FIELDS) {
    const field = await fieldRepo.findOne({
      where: { name: fieldName, report: { id: report.id } },
    });
    if (!field) {
      Logger.error(
        `Field '${fieldName}' missing on Monthly Location Categorization report.`,
      );
      await app.close();
      process.exit(1);
    }
    fieldMap.set(fieldName, field);
  }

  const adminUser = await userRepo.findOne({
    where: { username: 'admin@worshipharvest.org' },
  });
  if (!adminUser) {
    Logger.error('WHM admin user not found.');
    await app.close();
    process.exit(1);
  }

  const allLocations = await groupRepo
    .createQueryBuilder('g')
    .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
    .andWhere('g."metaData"->>\'code\' IS NOT NULL')
    .getMany();

  const locationByCode = new Map<string, Group>();
  for (const loc of allLocations) {
    const code = loc.metaData?.code as string | undefined;
    if (code) locationByCode.set(code.toUpperCase(), loc);
  }
  Logger.log(`Found ${locationByCode.size} seeded locations`);

  // Index existing submissions for idempotency (also covers Jul-Oct 2025
  // Champions-subset rows imported separately). Keyed on submission
  // existence for (group, reportingPeriod, report) — NOT on whether a
  // specific field (e.g. 'grade') is present, since most records have no
  // grade value.
  const existingSubmissions: Array<{
    groupId: number;
    reportingPeriod: string;
  }> = await conn.query(
    `SELECT rs."groupId", TO_CHAR(rs."reportingPeriod", 'YYYY-MM') AS "reportingPeriod"
     FROM report_submission rs
     WHERE rs."reportId" = $1`,
    [report.id],
  );
  const existingKeys = new Set(
    existingSubmissions.map((r) => `${r.groupId}::${r.reportingPeriod}`),
  );
  Logger.log(`${existingKeys.size} existing submissions — will skip`);

  let created = 0,
    skipped = 0,
    noGroup = 0;

  for (const rec of raw.records) {
    const group = locationByCode.get(rec.locationCode.toUpperCase());
    if (!group) {
      noGroup++;
      continue;
    }

    // reportingPeriod is YYYY-MM for monthly reports
    const period = rec.reportingPeriod;
    const key = `${group.id}::${period}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const submission = await submissionRepo.save(
      submissionRepo.create({
        report,
        group,
        user: adminUser,
        reportingPeriod: `${period}-01`, // stored as date, use first of month
      }),
    );

    const dataRows: Partial<ReportSubmissionData>[] = [];
    for (const fieldName of IMPORTABLE_FIELDS) {
      const val = rec[fieldName];
      if (val !== null && val !== undefined) {
        dataRows.push(
          submissionDataRepo.create({
            reportSubmission: { id: submission.id } as ReportSubmission,
            reportField: fieldMap.get(fieldName)!,
            fieldValue: String(val),
          }),
        );
      }
    }
    if (dataRows.length > 0) {
      await submissionDataRepo.save(dataRows);
    }

    existingKeys.add(key);
    created++;
  }

  Logger.log('─────────────────────────────────────');
  Logger.log(`Submissions created  : ${created}`);
  Logger.log(`Skipped (exists)     : ${skipped}`);
  Logger.log(`No group match       : ${noGroup}`);
  Logger.log('✅ WHM network-wide categorization import complete');

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
