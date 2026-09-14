import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which QuickBooks product/service a gift is for.
 *
 * `Transaction.category` is a four-value enum (tithe, offering, donation, arise
 * & build) but the church's QuickBooks carries twelve giving items — Offertory
 * – YXP, Firstfruits, Buy The Land and so on. Collapsing all of those into four
 * categories loses the distinction the books actually care about.
 *
 * The enum stays as a coarse classification, because distribution percentages
 * and reconciliation rules key off it. These columns carry the precise item, and
 * the sales receipt prefers them when they are set.
 */
export class AddGivingItemToTransaction1789200100000
  implements MigrationInterface
{
  name = 'AddGivingItemToTransaction1789200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "externalItemId" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "externalItemName" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN IF EXISTS "externalItemName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN IF EXISTS "externalItemId"`,
    );
  }
}
