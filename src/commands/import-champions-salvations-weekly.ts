/**
 * import-champions-salvations-weekly.ts
 * --------------------------------------
 * Reads data/outputs/champions_salvations_weekly_{year}.json (produced by
 * extract_champions_salvations_weekly.py) and populates the `salvations` field
 * (and `baptisms` where available) on Sunday Service Report submissions.
 *
 * Strategy:
 *   - If a submission already exists for (report, group, reportingPeriod) and
 *     already has a salvations row, skip it.
 *   - If a submission exists but has no salvations row, add it (gap-fill).
 *   - If no submission exists, create one with location metadata + salvations
 *     (and baptisms if present in the source record).
 *
 * Idempotent: skips any (group, reportingPeriod) that already has a salvations row.
 *
 * Run:
 *   npm run import:champions:salvations:2023
 *   npm run import:champions:salvations:2024
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

const YEAR = process.argv.includes('--year')
  ? process.argv[process.argv.indexOf('--year') + 1]
  : process.argv.find((a) => a === '2023' || a === '2024');

if (!YEAR || !['2023', '2024'].includes(YEAR)) {
  Logger.error(
    'Usage: ts-node ... import-champions-salvations-weekly.ts --year 2023|2024',
  );
  process.exit(1);
}

const DATA_FILE = path.join(
  __dirname,
  `../../data/outputs/champions_salvations_weekly_${YEAR}.json`,
);

interface WeeklyRecord {
  locationCode: string;
  weekDate: string;
  salvations: number;
  baptisms?: number;
}

interface DataFile {
  year: number;
  recordCount: number;
  records: WeeklyRecord[];
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error(
      `Run: python3 data/scripts/extract_champions_salvations_weekly.py --year ${YEAR} first`,
    );
    process.exit(1);
  }

  const raw: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  Logger.log(`Loaded ${raw.recordCount} records for year ${raw.year}`);

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

  const [salvationsField, baptismsField, locationNameField, locationIdField] =
    await Promise.all([
      fieldRepo.findOne({
        where: { name: 'salvations', report: { id: report.id } },
      }),
      fieldRepo.findOne({
        where: { name: 'baptisms', report: { id: report.id } },
      }),
      fieldRepo.findOne({
        where: { name: 'serviceLocationName', report: { id: report.id } },
      }),
      fieldRepo.findOne({
        where: { name: 'serviceLocationId', report: { id: report.id } },
      }),
    ]);
  if (
    !salvationsField ||
    !baptismsField ||
    !locationNameField ||
    !locationIdField
  ) {
    Logger.error(
      'Required fields missing on Sunday Service Report. Run seed:whm:reports first.',
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

  // Index existing salvations rows (idempotency)
  const existingSalvations: Array<{
    groupId: number;
    reportingPeriod: string;
  }> = await conn.query(
    `SELECT rs."groupId", TO_CHAR(rs."reportingPeriod", 'YYYY-MM-DD') AS "reportingPeriod"
       FROM report_submission_data sd
       INNER JOIN report_submission rs ON sd."reportSubmissionId" = rs.id
       INNER JOIN report_field rf ON sd."reportFieldId" = rf.id
       WHERE rs."reportId" = $1 AND rf.name = 'salvations'`,
    [report.id],
  );

  const existingSalvKeys = new Set<string>(
    existingSalvations.map((r) => `${r.groupId}::${r.reportingPeriod}`),
  );
  Logger.log(
    `${existingSalvKeys.size} salvations rows already exist — will skip`,
  );

  // Index existing submissions: (groupId, reportingPeriod) → id
  const existingSubmissions: Array<{
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
  for (const row of existingSubmissions) {
    submissionIdByKey.set(`${row.groupId}::${row.reportingPeriod}`, row.id);
  }
  Logger.log(`${submissionIdByKey.size} existing submissions indexed`);

  let salvAdded = 0;
  let baptAdded = 0;
  let submissionsCreated = 0;
  let gapFilled = 0;
  let skipped = 0;
  let noGroup = 0;

  for (const rec of raw.records) {
    const group = locationByCode.get(rec.locationCode.toUpperCase());
    if (!group) {
      noGroup++;
      continue;
    }

    const key = `${group.id}::${rec.weekDate}`;

    if (existingSalvKeys.has(key)) {
      skipped++;
      continue;
    }

    let submissionId = submissionIdByKey.get(key);

    if (!submissionId) {
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
    } else {
      gapFilled++;
    }

    await submissionDataRepo.save(
      submissionDataRepo.create({
        reportSubmission: { id: submissionId } as ReportSubmission,
        reportField: salvationsField,
        fieldValue: String(rec.salvations),
      }),
    );
    existingSalvKeys.add(key);
    salvAdded++;

    if (rec.baptisms != null) {
      // Only write baptisms if not already present
      const hasBapt = await conn.query(
        `SELECT 1 FROM report_submission_data sd
         INNER JOIN report_field rf ON sd."reportFieldId" = rf.id
         WHERE sd."reportSubmissionId" = $1 AND rf.name = 'baptisms'
         LIMIT 1`,
        [submissionId],
      );
      if (!hasBapt.length) {
        await submissionDataRepo.save(
          submissionDataRepo.create({
            reportSubmission: { id: submissionId } as ReportSubmission,
            reportField: baptismsField,
            fieldValue: String(rec.baptisms),
          }),
        );
        baptAdded++;
      }
    }
  }

  Logger.log('─────────────────────────────────────');
  Logger.log(`Salvations added     : ${salvAdded}`);
  Logger.log(`Baptisms added       : ${baptAdded}`);
  Logger.log(`New submissions      : ${submissionsCreated}`);
  Logger.log(`Gap-filled (existing): ${gapFilled}`);
  Logger.log(`Skipped (has salvs)  : ${skipped}`);
  Logger.log(`No group match       : ${noGroup}`);
  Logger.log(`✅ Weekly salvations ${YEAR} import complete`);

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
