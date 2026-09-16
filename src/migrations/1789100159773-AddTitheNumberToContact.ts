import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTitheNumberToContact1789100159773
  implements MigrationInterface
{
  name = 'AddTitheNumberToContact1789100159773';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "titheNumber" character varying(50)',
    );
    // Partial unique index: only enforces uniqueness when titheNumber is not null
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_contact_tenant_tithe_number"
      ON "contact" ("tenantId", "titheNumber")
      WHERE "titheNumber" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_contact_tenant_tithe_number"',
    );
    await queryRunner.query(
      'ALTER TABLE "contact" DROP COLUMN IF EXISTS "titheNumber"',
    );
  }
}
