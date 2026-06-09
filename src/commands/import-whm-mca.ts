/**
 * import-whm-mca.ts
 * -----------------
 * Reads data/outputs/mca_weekly_data.json (produced by extract_mca_data.py)
 * and populates the `mca` field on Sunday Service Report submissions.
 *
 * Strategy:
 *   - If a submission already exists for (report, group, reportingPeriod),
 *     add an `mca` report_submission_data row to it.
 *   - If no submission exists, create one with only `mca` populated.
 *
 * Idempotent: skips any (group, reportingPeriod) that already has an mca row.
 *
 * Run:
 *   npm run import:whm:mca
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
  '../../data/outputs/mca_weekly_data.json',
);

interface McaRecord {
  locationCode: string;
  weekDate: string;
  mca: number;
}

interface DataFile {
  recordCount: number;
  locationCount: number;
  weekCount: number;
  records: McaRecord[];
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error('Run: python3 data/scripts/extract_mca_data.py first');
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
    where: { name: 'Sunday Service Report', tenant: { id: tenant.id } },
  });
  if (!report) {
    Logger.error(
      'Sunday Service Report not found. Run seed:whm:reports first.',
    );
    await app.close();
    process.exit(1);
  }

  const [mcaField, locationNameField, locationIdField] = await Promise.all([
    fieldRepo.findOne({ where: { name: 'mca', report: { id: report.id } } }),
    fieldRepo.findOne({
      where: { name: 'serviceLocationName', report: { id: report.id } },
    }),
    fieldRepo.findOne({
      where: { name: 'serviceLocationId', report: { id: report.id } },
    }),
  ]);
  if (!mcaField || !locationNameField || !locationIdField) {
    Logger.error(
      'Required fields (mca / serviceLocationName / serviceLocationId) not found on Sunday Service Report. Run seed:whm:reports first.',
    );
    await app.close();
    process.exit(1);
  }

  const adminUser = await userRepo.findOne({
    where: { username: 'admin@worshipharvest.org' },
  });
  if (!adminUser) {
    Logger.error('WHM admin user not found. Run seed:reset first.');
    await app.close();
    process.exit(1);
  }

  // Build location code → group map
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

  // Build set of (groupId, reportingPeriod) that already have an mca row
  // to make the import idempotent
  const existingMca: Array<{ groupId: number; reportingPeriod: string }> =
    await conn.query(
      `SELECT rs."groupId", TO_CHAR(rs."reportingPeriod", 'YYYY-MM-DD') AS "reportingPeriod"
       FROM report_submission_data sd
       INNER JOIN report_submission rs ON sd."reportSubmissionId" = rs.id
       INNER JOIN report_field rf ON sd."reportFieldId" = rf.id
       WHERE rs."reportId" = $1 AND rf.name = 'mca'`,
      [report.id],
    );

  const existingMcaKeys = new Set<string>(
    existingMca.map((r) => `${r.groupId}::${r.reportingPeriod}`),
  );
  Logger.log(`${existingMcaKeys.size} mca rows already exist — will skip`);

  // Build map of existing submissions: (groupId, reportingPeriod) → id
  const existingSubmissionRows: Array<{
    id: number;
    groupId: number;
    reportingPeriod: string;
  }> = await conn.query(
    `SELECT s.id, s."groupId", TO_CHAR(s."reportingPeriod", 'YYYY-MM-DD') AS "reportingPeriod"
     FROM report_submission s
     WHERE s."reportId" = $1 AND s."reportingPeriod" IS NOT NULL`,
    [report.id],
  );

  const submissionIdByKey = new Map<string, number>();
  for (const row of existingSubmissionRows) {
    submissionIdByKey.set(`${row.groupId}::${row.reportingPeriod}`, row.id);
  }
  Logger.log(`${submissionIdByKey.size} existing submissions indexed`);

  let mcaAdded = 0;
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

    if (existingMcaKeys.has(key)) {
      skipped++;
      continue;
    }

    let submissionId = submissionIdByKey.get(key);

    if (!submissionId) {
      // No PGA submission exists for this week — create a stub with location metadata
      const created = await submissionRepo.save(
        submissionRepo.create({
          report,
          group,
          user: adminUser,
          reportingPeriod: rec.weekDate,
        }),
      );
      submissionId = created.id;
      submissionIdByKey.set(key, submissionId);
      submissionsCreated++;
      await submissionDataRepo.save([
        submissionDataRepo.create({
          reportSubmission: { id: submissionId } as ReportSubmission,
          reportField: locationNameField,
          fieldValue: group.name,
        }),
        submissionDataRepo.create({
          reportSubmission: { id: submissionId } as ReportSubmission,
          reportField: locationIdField,
          fieldValue: String(group.id),
        }),
      ]);
    }

    await submissionDataRepo.save(
      submissionDataRepo.create({
        reportSubmission: { id: submissionId } as ReportSubmission,
        reportField: mcaField,
        fieldValue: String(rec.mca),
      }),
    );
    existingMcaKeys.add(key);
    mcaAdded++;
  }

  Logger.log('─────────────────────────────────────');
  Logger.log(`MCA rows added      : ${mcaAdded}`);
  Logger.log(`New submissions     : ${submissionsCreated}`);
  Logger.log(`Skipped (existing)  : ${skipped}`);
  Logger.log(`No group match      : ${noGroup}`);
  Logger.log('✅ MCA import complete');

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
