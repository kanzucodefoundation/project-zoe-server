import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `CREATE UNIQUE INDEX IF NOT EXISTS` lets `up()` succeed when these indexes
 * were already created by hand, which is how they reached staging. A `down()`
 * that drops them by name regardless would then remove an index this migration
 * never created, and — because they are unique indexes guarding duplicate
 * report submissions — silently reopen the door they were added to close.
 *
 * Each index created here is stamped with a comment naming this migration, and
 * `down()` drops only the stamped ones.
 */
export class ReportSubmissionWeeklyLimitUniqueIndexes1783922603436
  implements MigrationInterface
{
  name = 'ReportSubmissionWeeklyLimitUniqueIndexes1783922603436';

  private static readonly MARKER =
    'created-by:ReportSubmissionWeeklyLimitUniqueIndexes1783922603436';

  private async indexExists(
    queryRunner: QueryRunner,
    relname: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [relname],
    );
    return rows.length > 0;
  }

  private async isOurs(
    queryRunner: QueryRunner,
    relname: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT obj_description(c.oid, 'pg_class') AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [relname],
    );
    return (
      rows[0]?.comment ===
      ReportSubmissionWeeklyLimitUniqueIndexes1783922603436.MARKER
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const marker = ReportSubmissionWeeklyLimitUniqueIndexes1783922603436.MARKER;

    const groupIndexPreexisted = await this.indexExists(
      queryRunner,
      'IDX_report_submission_group_period_unique',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_submission_group_period_unique"
        ON "report_submission" ("reportId", "groupId", "reportingPeriod")
        WHERE "groupId" IS NOT NULL
    `);
    if (!groupIndexPreexisted) {
      await queryRunner.query(
        `COMMENT ON INDEX "public"."IDX_report_submission_group_period_unique" IS '${marker}'`,
      );
    }

    const userIndexPreexisted = await this.indexExists(
      queryRunner,
      'IDX_report_submission_user_period_unique',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_submission_user_period_unique"
        ON "report_submission" ("reportId", "userId", "reportingPeriod")
        WHERE "groupId" IS NULL
    `);
    if (!userIndexPreexisted) {
      await queryRunner.query(
        `COMMENT ON INDEX "public"."IDX_report_submission_user_period_unique" IS '${marker}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await this.isOurs(queryRunner, 'IDX_report_submission_user_period_unique')
    ) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_report_submission_user_period_unique"',
      );
    }
    if (
      await this.isOurs(
        queryRunner,
        'IDX_report_submission_group_period_unique',
      )
    ) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_report_submission_group_period_unique"',
      );
    }
  }
}
