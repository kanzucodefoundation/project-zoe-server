import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailUsernameConstraintFixes1783516097579
  implements MigrationInterface
{
  name = 'EmailUsernameConstraintFixes1783516097579';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // contact_status_enum already exists on staging/prod (added manually) — skip if present
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."contact_status_enum" AS ENUM('Active', 'Inactive', 'MovedAway', 'TransferredToAnotherChurch', 'Deceased');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(
      'ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "status" "public"."contact_status_enum" DEFAULT \'Active\'',
    );
    await queryRunner.query(
      'ALTER TABLE "user" ADD "email" character varying(100)',
    );
    await queryRunner.query(
      'ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(254)',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_8a960aba8277f39a0a47817ca7"',
    );
    await queryRunner.query(
      'ALTER TYPE "public"."contact_activity_type_enum" RENAME TO "contact_activity_type_enum_old"',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contact_activity_type_enum\" AS ENUM('first_visit', 'got_saved', 'matched_to_fellowship', 'attended_fellowship', 'joined_serving_team', 'got_baptised', 'unreachable', 'task_created', 'task_assigned', 'task_completed', 'joined_group', 'left_group', 'attended_event')",
    );
    await queryRunner.query(
      'ALTER TABLE "contact_activity" ALTER COLUMN "type" TYPE "public"."contact_activity_type_enum" USING "type"::"text"::"public"."contact_activity_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."contact_activity_type_enum_old"',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_fc52434ee9440fcb15b198cf85" ON "user" ("email", "tenantId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_8a960aba8277f39a0a47817ca7" ON "contact_activity" ("tenantId", "type")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_8a960aba8277f39a0a47817ca7"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_fc52434ee9440fcb15b198cf85"',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contact_activity_type_enum_old\" AS ENUM('first_visit', 'got_saved', 'matched_to_fellowship', 'attended_fellowship', 'joined_serving_team', 'got_baptised', 'task_created', 'task_assigned', 'task_completed', 'joined_group', 'left_group', 'attended_event')",
    );
    await queryRunner.query(
      'ALTER TABLE "contact_activity" ALTER COLUMN "type" TYPE "public"."contact_activity_type_enum_old" USING "type"::"text"::"public"."contact_activity_type_enum_old"',
    );
    await queryRunner.query('DROP TYPE "public"."contact_activity_type_enum"');
    await queryRunner.query(
      'ALTER TYPE "public"."contact_activity_type_enum_old" RENAME TO "contact_activity_type_enum"',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_8a960aba8277f39a0a47817ca7" ON "contact_activity" ("tenantId", "type") ',
    );
    await queryRunner.query(
      'UPDATE "user" SET "username" = substring("username" from 1 for 40) WHERE length("username") > 40',
    );
    await queryRunner.query(
      'ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(40)',
    );
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "email"');
    await queryRunner.query('ALTER TABLE "contact" DROP COLUMN "status"');
    await queryRunner.query('DROP TYPE "public"."contact_status_enum"');
  }
}
