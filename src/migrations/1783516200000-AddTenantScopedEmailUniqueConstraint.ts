import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantScopedEmailUniqueConstraint1783516200000
  implements MigrationInterface
{
  name = 'AddTenantScopedEmailUniqueConstraint1783516200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Denormalize tenantId onto email so we can enforce a tenant-scoped
    // uniqueness constraint at the DB level (email has no direct tenant
    // column today — it's only reachable via email.contact.tenantId).
    await queryRunner.query(
      'ALTER TABLE "email" ADD COLUMN IF NOT EXISTS "tenantId" integer',
    );

    // Backfill from the owning contact.
    await queryRunner.query(`
      UPDATE "email" e
      SET "tenantId" = c."tenantId"
      FROM "contact" c
      WHERE e."contactId" = c."id"
        AND e."tenantId" IS NULL
    `);

    await queryRunner.query(
      'ALTER TABLE "email" ALTER COLUMN "tenantId" SET NOT NULL',
    );

    await queryRunner.query(
      'ALTER TABLE "email" ADD CONSTRAINT "FK_email_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE',
    );

    // Tenant-scoped, case/whitespace-insensitive uniqueness. Mirrors the
    // normalization ContactsService.normalizeEmail()/assertEmailsAreUnique()
    // already do in the application layer, so a race between two concurrent
    // requests now fails at the DB with 23505 instead of both succeeding.
    // Fail loudly with the offending pairs instead of a bare unique-violation
    // if legacy data already contains tenant-scoped duplicates.
    const duplicates = await queryRunner.query(`
      SELECT "tenantId", LOWER(TRIM("value")) AS normalized, COUNT(*) AS count
      FROM "email"
      GROUP BY "tenantId", LOWER(TRIM("value"))
      HAVING COUNT(*) > 1
    `);
    if (duplicates.length > 0) {
      throw new Error(
        `Cannot create IDX_email_tenant_normalized_value: ${duplicates.length} duplicate (tenantId, normalized email) groups exist. Resolve them before deploying.`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_email_tenant_normalized_value"
      ON "email" (LOWER(TRIM("value")), "tenantId")
      WHERE "value" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_email_tenant_normalized_value"',
    );
    await queryRunner.query(
      'ALTER TABLE "email" DROP CONSTRAINT "FK_email_tenantId"',
    );
    await queryRunner.query('ALTER TABLE "email" DROP COLUMN "tenantId"');
  }
}
