import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportSubmissionWeeklyLimitUniqueIndexes1783922603436
  implements MigrationInterface
{
  name = 'ReportSubmissionWeeklyLimitUniqueIndexes1783922603436';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_report_submission_group_period_unique"
        ON "report_submission" ("reportId", "groupId", "reportingPeriod")
        WHERE "groupId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_report_submission_user_period_unique"
        ON "report_submission" ("reportId", "userId", "reportingPeriod")
        WHERE "groupId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_report_submission_user_period_unique"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_report_submission_group_period_unique"',
    );
  }
}
