/**
 * import-champions-oikos-2022.ts
 * --------------------------------
 * Reads data/outputs/champions_oikos_2022.json (produced by
 * extract_champions_oikos_2022.py) and populates weekly Oikos metrics
 * on the Weekly Oikos Report for each (location, week) pair.
 *
 * The source data is per-location (not per-zone), so submissions are
 * linked to Location groups even though the report's targetGroupCategoryId
 * points to Zone. This matches the Champions era data granularity.
 *
 * Strategy:
 *   - If a submission already exists for (report, group, reportingPeriod)
 *     and already has an 'mcs' row, skip it.
 *   - If no submission exists, create one with all available fields.
 *
 * Idempotent: skips any (group, reportingPeriod) that already has an mcs row.
 *
 * Run:
 *   npm run import:champions:oikos2022
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
  '../../data/outputs/champions_oikos_2022.json',
);

interface OikosRecord {
  locationCode: string;
  weekDate: string;
  mcs: number | null;
  mcm: number | null;
  mca: number | null;
  salvations: number | null;
  visitations: number | null;
}

interface DataFile {
  recordCount: number;
  locationCount: number;
  weekCount: number;
  records: OikosRecord[];
}

const FIELDS = ['mcs', 'mcm', 'mca', 'salvations', 'visitations'] as const;

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error(
      'Run: python3 data/scripts/extract_champions_oikos_2022.py first',
    );
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
  const fieldRepo = conn.getRepository(ReportField);
  const groupRepo = conn.getRepository(Group);
  const submissionRepo = conn.getRepository(ReportSubmission);
  const submissionDataRepo = conn.getRepository(ReportSubmissionData);
  const userRepo = conn.getRepository(User);

  const tenant = await tenantRepo.findOne({
    where: { name: 'worshipharvest' },
  });
  if (!tenant) {
    Logger.error('WHM tenant not found. Run seed:reset first.');
    await app.close();
    process.exit(1);
  }

  const report = await reportRepo.findOne({
    where: { name: 'Weekly Oikos Report', tenant: { id: tenant.id } },
  });
  if (!report) {
    Logger.error('Weekly Oikos Report not found. Run seed:whm:reports first.');
    await app.close();
    process.exit(1);
  }

  const fieldMap = new Map<string, ReportField>();
  for (const fieldName of FIELDS) {
    const field = await fieldRepo.findOne({
      where: { name: fieldName, report: { id: report.id } },
    });
    if (!field) {
      Logger.error(
        `Field '${fieldName}' missing on Weekly Oikos Report. Run seed:whm:reports first.`,
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
    Logger.error('WHM admin user not found. Run seed:reset first.');
    await app.close();
    process.exit(1);
  }

  // Build location code → group map (Location groups)
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
  Logger.log(`Found ${locationByCode.size} seeded locations with codes`);

  // Index existing mcs rows: set of "groupId::reportingPeriod" already imported
  const existingMcs: Array<{ groupId: number; reportingPeriod: string }> =
    await conn.query(
      `SELECT rs."groupId", TO_CHAR(rs."reportingPeriod", 'YYYY-MM-DD') AS "reportingPeriod"
       FROM report_submission_data sd
       INNER JOIN report_submission rs ON sd."reportSubmissionId" = rs.id
       INNER JOIN report_field rf ON sd."reportFieldId" = rf.id
       WHERE rs."reportId" = $1 AND rf.name = 'mcs'`,
      [report.id],
    );

  const existingKeys = new Set<string>(
    existingMcs.map((r) => `${r.groupId}::${r.reportingPeriod}`),
  );
  Logger.log(`${existingKeys.size} existing mcs rows — will skip those`);

  let submissionsCreated = 0;
  let skipped = 0;
  let noGroup = 0;

  for (const rec of raw.records) {
    const group = locationByCode.get(rec.locationCode.toUpperCase());
    if (!group) {
      noGroup++;
      continue;
    }

    const key = `${group.id}::${rec.weekDate}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const submission = await submissionRepo.save(
      submissionRepo.create({
        report,
        group,
        user: adminUser,
        reportingPeriod: rec.weekDate,
      }),
    );

    const dataRows: Partial<ReportSubmissionData>[] = [];
    for (const fieldName of FIELDS) {
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
    submissionsCreated++;
  }

  Logger.log('─────────────────────────────────────');
  Logger.log(`Submissions created  : ${submissionsCreated}`);
  Logger.log(`Skipped (exists)     : ${skipped}`);
  Logger.log(`No group match       : ${noGroup}`);
  Logger.log('✅ Champions Oikos 2022 import complete');

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
