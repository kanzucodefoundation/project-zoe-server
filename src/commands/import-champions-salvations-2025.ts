/**
 * import-champions-salvations-2025.ts
 * -------------------------------------
 * Reads data/outputs/champions_salvations_2025.json and populates annual
 * salvations & baptisms on the Annual Salvations & Baptisms report for
 * global Champions network locations (2025).
 *
 * Idempotent: skips (group, reportingPeriod) that already have a salvations row.
 *
 * Run:
 *   npm run import:champions:salvations:2025
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
  '../../data/outputs/champions_salvations_2025.json',
);

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    Logger.error(`Data file not found: ${DATA_FILE}`);
    Logger.error(
      'Run: python3 data/scripts/extract_champions_salvations_2025.py first',
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  Logger.log(
    `Loaded ${raw.recordCount} records | reportingPeriod: ${raw.reportingPeriod}`,
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
    where: { name: 'Annual Salvations & Baptisms', tenant: { id: tenant.id } },
  });
  if (!report) {
    Logger.error(
      'Annual Salvations & Baptisms report not found. Run seed:whm:reports first.',
    );
    await app.close();
    process.exit(1);
  }

  const [salvationsField, baptismsField] = await Promise.all([
    fieldRepo.findOne({
      where: { name: 'salvations', report: { id: report.id } },
    }),
    fieldRepo.findOne({
      where: { name: 'baptisms', report: { id: report.id } },
    }),
  ]);
  if (!salvationsField || !baptismsField) {
    Logger.error(
      'Required fields missing on Annual Salvations & Baptisms report.',
    );
    await app.close();
    process.exit(1);
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
  const existingKeys = new Set(
    existingSalvations.map((r) => `${r.groupId}::${r.reportingPeriod}`),
  );
  Logger.log(`${existingKeys.size} existing salvations rows — will skip`);

  let created = 0,
    skipped = 0,
    noGroup = 0;

  for (const rec of raw.records) {
    const group = locationByCode.get(rec.locationCode.toUpperCase());
    if (!group) {
      noGroup++;
      continue;
    }

    const key = `${group.id}::${raw.reportingPeriod}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const submission = await submissionRepo.save(
      submissionRepo.create({
        report,
        group,
        user: adminUser,
        reportingPeriod: raw.reportingPeriod,
      }),
    );

    const dataRows: Partial<ReportSubmissionData>[] = [];
    if (rec.salvations !== undefined) {
      dataRows.push(
        submissionDataRepo.create({
          reportSubmission: { id: submission.id } as ReportSubmission,
          reportField: salvationsField,
          fieldValue: String(rec.salvations),
        }),
      );
    }
    if (rec.baptisms !== undefined) {
      dataRows.push(
        submissionDataRepo.create({
          reportSubmission: { id: submission.id } as ReportSubmission,
          reportField: baptismsField,
          fieldValue: String(rec.baptisms),
        }),
      );
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
  if (noGroup > 0) {
    const unmatched = raw.records
      .filter((r: any) => !locationByCode.has(r.locationCode.toUpperCase()))
      .map((r: any) => r.locationCode);
    Logger.warn(`Unmatched codes: ${unmatched.join(', ')}`);
  }
  Logger.log('✅ Champions 2025 salvations import complete');

  await app.close();
}

run().catch((err) => {
  Logger.error('Import failed:', err);
  process.exit(1);
});
