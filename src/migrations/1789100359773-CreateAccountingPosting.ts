import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingPosting1789100359773
  implements MigrationInterface
{
  name = 'CreateAccountingPosting1789100359773';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."accounting_posting_system_enum" AS ENUM('QUICKBOOKS');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."accounting_posting_document_type_enum" AS ENUM('SALES_RECEIPT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."accounting_posting_status_enum" AS ENUM('PENDING', 'POSTED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_posting" (
        "id"                     SERIAL PRIMARY KEY,
        "tenantId"               integer NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
        "transactionId"          integer NOT NULL REFERENCES "transaction"("id") ON DELETE CASCADE,
        "system"                 "public"."accounting_posting_system_enum" NOT NULL DEFAULT 'QUICKBOOKS',
        "documentType"           "public"."accounting_posting_document_type_enum" NOT NULL DEFAULT 'SALES_RECEIPT',
        "status"                 "public"."accounting_posting_status_enum" NOT NULL DEFAULT 'PENDING',
        "externalDocumentId"     character varying(100),
        "externalDocumentNumber" character varying(100),
        "errorMessage"           text,
        "requestedById"          integer REFERENCES "user"("id") ON DELETE SET NULL,
        "requestedAt"            timestamptz NOT NULL DEFAULT now(),
        "postedAt"               timestamptz,
        "createdAt"              timestamptz NOT NULL DEFAULT now(),
        "updatedAt"              timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accounting_posting_tenant_transaction"
      ON "accounting_posting" ("tenantId", "transactionId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accounting_posting_tenant_status"
      ON "accounting_posting" ("tenantId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_accounting_posting_tenant_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_accounting_posting_tenant_transaction"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "accounting_posting"');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."accounting_posting_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."accounting_posting_document_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."accounting_posting_system_enum"',
    );
  }
}
