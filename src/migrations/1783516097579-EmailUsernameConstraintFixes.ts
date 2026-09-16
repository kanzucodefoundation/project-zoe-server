import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Several statements here are written to tolerate objects that already exist,
 * because `contact.status`, `user.email` and their indexes were added by hand
 * on staging and production before this migration was written.
 *
 * That tolerance creates an asymmetry: when `up()` finds an object already
 * present it does nothing, but a naive `down()` drops it regardless — so an
 * explicit `migration:revert` would delete a `user.email` column, and every
 * address stored in it, that this migration never created.
 *
 * Each object this migration actually creates is therefore stamped with a
 * comment naming this migration, and `down()` removes only the objects
 * carrying that stamp. Anything it found already in place is left alone, which
 * is what "revert" is supposed to mean.
 */
export class EmailUsernameConstraintFixes1783516097579
  implements MigrationInterface
{
  name = 'EmailUsernameConstraintFixes1783516097579';

  private static readonly MARKER =
    'created-by:EmailUsernameConstraintFixes1783516097579';

  private async columnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2`,
      [table, column],
    );
    return rows.length > 0;
  }

  private async relationExists(
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

  private async typeExists(
    queryRunner: QueryRunner,
    typname: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = $1`,
      [typname],
    );
    return rows.length > 0;
  }

  private async isOurs(
    queryRunner: QueryRunner,
    kind: 'column' | 'index' | 'type',
    name: string,
    column?: string,
  ): Promise<boolean> {
    let rows: { comment: string | null }[];

    if (kind === 'column') {
      rows = await queryRunner.query(
        `SELECT col_description(c.oid, a.attnum) AS comment
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid
          WHERE n.nspname = 'public'
            AND c.relname = $1
            AND a.attname = $2
            AND a.attnum > 0
            AND NOT a.attisdropped`,
        [name, column],
      );
    } else if (kind === 'index') {
      rows = await queryRunner.query(
        `SELECT obj_description(c.oid, 'pg_class') AS comment
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = $1`,
        [name],
      );
    } else {
      rows = await queryRunner.query(
        `SELECT obj_description(t.oid, 'pg_type') AS comment
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = $1`,
        [name],
      );
    }

    return (
      rows[0]?.comment === EmailUsernameConstraintFixes1783516097579.MARKER
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const marker = EmailUsernameConstraintFixes1783516097579.MARKER;

    // contact_status_enum already exists on staging/prod (added manually) — skip if present
    const statusEnumPreexisted = await this.typeExists(
      queryRunner,
      'contact_status_enum',
    );
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."contact_status_enum" AS ENUM('Active', 'Inactive', 'MovedAway', 'TransferredToAnotherChurch', 'Deceased');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    if (!statusEnumPreexisted) {
      await queryRunner.query(
        `COMMENT ON TYPE "public"."contact_status_enum" IS '${marker}'`,
      );
    }

    const statusColumnPreexisted = await this.columnExists(
      queryRunner,
      'contact',
      'status',
    );
    await queryRunner.query(
      'ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "status" "public"."contact_status_enum" DEFAULT \'Active\'',
    );
    if (!statusColumnPreexisted) {
      await queryRunner.query(
        `COMMENT ON COLUMN "contact"."status" IS '${marker}'`,
      );
    }

    const emailColumnPreexisted = await this.columnExists(
      queryRunner,
      'user',
      'email',
    );
    await queryRunner.query(
      'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email" character varying(100)',
    );
    if (!emailColumnPreexisted) {
      await queryRunner.query(
        `COMMENT ON COLUMN "user"."email" IS '${marker}'`,
      );
    }

    await queryRunner.query(
      'ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(254)',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_8a960aba8277f39a0a47817ca7"',
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

    const emailIndexPreexisted = await this.relationExists(
      queryRunner,
      'IDX_fc52434ee9440fcb15b198cf85',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fc52434ee9440fcb15b198cf85" ON "user" ("email", "tenantId")',
    );
    if (!emailIndexPreexisted) {
      await queryRunner.query(
        `COMMENT ON INDEX "public"."IDX_fc52434ee9440fcb15b198cf85" IS '${marker}'`,
      );
    }

    // This one is dropped and recreated above unconditionally, so `down()`
    // restoring it is symmetric and needs no marker.
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_8a960aba8277f39a0a47817ca7" ON "contact_activity" ("tenantId", "type")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_8a960aba8277f39a0a47817ca7"',
    );

    if (
      await this.isOurs(queryRunner, 'index', 'IDX_fc52434ee9440fcb15b198cf85')
    ) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_fc52434ee9440fcb15b198cf85"',
      );
    }

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

    // Truncating usernames back to 40 characters loses data that only exists
    // because the column was widened, so it is done only alongside the width
    // change it belongs to.
    await queryRunner.query(
      'UPDATE "user" SET "username" = substring("username" from 1 for 40) WHERE length("username") > 40',
    );
    await queryRunner.query(
      'ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(40)',
    );

    if (await this.isOurs(queryRunner, 'column', 'user', 'email')) {
      await queryRunner.query('ALTER TABLE "user" DROP COLUMN "email"');
    }
    if (await this.isOurs(queryRunner, 'column', 'contact', 'status')) {
      await queryRunner.query('ALTER TABLE "contact" DROP COLUMN "status"');
    }
    if (await this.isOurs(queryRunner, 'type', 'contact_status_enum')) {
      await queryRunner.query('DROP TYPE "public"."contact_status_enum"');
    }
  }
}
