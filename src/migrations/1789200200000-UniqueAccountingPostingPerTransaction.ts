import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One accounting posting per transaction, enforced by the database.
 *
 * Posting checked for an existing POSTED row, then inserted a PENDING one, then
 * called QuickBooks. Two requests for the same transaction could both pass that
 * check and both create a sales receipt, because the only index on
 * (tenantId, transactionId) was non-unique. A giver would be credited twice and
 * the books would need a manual correction.
 *
 * With this constraint the insert itself becomes the claim: whoever wins writes
 * the row, and a retry updates that same row rather than adding another.
 *
 * Building the index requires the existing duplicates to go. Those rows are
 * evidence — a duplicate POSTED row names a real second receipt sitting in
 * QuickBooks that someone has to find and void — so nothing is discarded. Every
 * removed row is copied first into `accounting_posting_duplicate_archive`,
 * which this migration creates and deliberately leaves behind on rollback.
 */
export class UniqueAccountingPostingPerTransaction1789200200000
  implements MigrationInterface
{
  name = 'UniqueAccountingPostingPerTransaction1789200200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The archive mirrors the source table's own column types, so nothing has
    // to name the enum types. Their names differ between databases depending on
    // whether TypeORM or a migration created them, and a hardcoded name makes
    // the restore fail on exactly the environment that needs it.
    //
    // Created only if absent, never dropped first: this migration can be run
    // again after a revert, and an audit table that the next run empties would
    // not be an audit table at all.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_posting_duplicate_archive" (
        LIKE "accounting_posting"
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "accounting_posting_duplicate_archive"
        ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "archivedBy" character varying(255) NOT NULL
    `);

    // Which row survives per (tenant, transaction, system, documentType): a
    // successful posting over anything else, then the most recent attempt.
    const losers = `
      SELECT p.*
      FROM "accounting_posting" p
      WHERE EXISTS (
        SELECT 1 FROM "accounting_posting" b
        WHERE b."tenantId" = p."tenantId"
          AND b."transactionId" = p."transactionId"
          AND b."system" = p."system"
          AND b."documentType" = p."documentType"
          AND (
            (b."status" = 'POSTED' AND p."status" <> 'POSTED')
            OR (
              (b."status" = 'POSTED') = (p."status" = 'POSTED')
              AND (b."createdAt", b."id") > (p."createdAt", p."id")
            )
          )
      )
    `;

    await queryRunner.query(`
      INSERT INTO "accounting_posting_duplicate_archive"
      SELECT l.*, now(), '${this.name}' FROM (${losers}) l
    `);

    await queryRunner.query(`
      DELETE FROM "accounting_posting" p
      WHERE p."id" IN (SELECT l."id" FROM (${losers}) l)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accounting_posting_tenant_transaction_doc"
      ON "accounting_posting" ("tenantId", "transactionId", "system", "documentType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."UQ_accounting_posting_tenant_transaction_doc"',
    );

    // Put the archived duplicates back now the constraint no longer forbids
    // them, so a rollback restores exactly what was there before. The table is
    // absent if this migration never archived anything, so check before
    // reading it.
    const [{ present }] = await queryRunner.query(
      `SELECT to_regclass('public.accounting_posting_duplicate_archive') IS NOT NULL AS present`,
    );
    if (!present) {
      return;
    }

    // Scoped to one schema. Without it a same-named table in any other schema
    // contributes its columns too, and the restore would build an INSERT whose
    // column list is doubled.
    const columns = await queryRunner.query(`
      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) AS cols
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_posting'
    `);
    const cols = columns[0].cols;

    await queryRunner.query(`
      INSERT INTO "accounting_posting" (${cols})
      SELECT ${cols}
      FROM "accounting_posting_duplicate_archive" a
      WHERE a."archivedBy" = '${this.name}'
        AND NOT EXISTS (
          SELECT 1 FROM "accounting_posting" p WHERE p."id" = a."id"
        )
    `);

    await queryRunner.query(`
      DELETE FROM "accounting_posting_duplicate_archive"
      WHERE "archivedBy" = '${this.name}'
    `);
  }
}
