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
 */
export class UniqueAccountingPostingPerTransaction1789200200000
  implements MigrationInterface
{
  name = 'UniqueAccountingPostingPerTransaction1789200200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing duplicates have to go first or the index cannot be built.
    // Keep the most meaningful row per transaction: a successful posting over
    // anything else, then the most recent attempt.
    await queryRunner.query(`
      DELETE FROM "accounting_posting" a
      USING "accounting_posting" b
      WHERE a."tenantId" = b."tenantId"
        AND a."transactionId" = b."transactionId"
        AND a."system" = b."system"
        AND a."documentType" = b."documentType"
        AND (
          (b."status" = 'POSTED' AND a."status" <> 'POSTED')
          OR (
            (b."status" = 'POSTED') = (a."status" = 'POSTED')
            AND (b."createdAt", b."id") > (a."createdAt", a."id")
          )
        )
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
  }
}
