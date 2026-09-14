import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gender becomes optional on Person.
 *
 * People are imported from QuickBooks, which has no gender field. Requiring one
 * forced the importer to invent a value for every record it created, which put
 * fabricated data in the CRM. Leaving it null records honestly that it is not
 * known, and it can be filled in later.
 */
export class MakePersonGenderNullable1789200000000
  implements MigrationInterface
{
  name = 'MakePersonGenderNullable1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "person" ALTER COLUMN "gender" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The column cannot go back to NOT NULL while unknown genders exist, so
    // anything imported without one is stamped Male purely to satisfy the
    // constraint. This is lossy — that is the nature of reverting.
    await queryRunner.query(
      `UPDATE "person" SET "gender" = 'Male' WHERE "gender" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "person" ALTER COLUMN "gender" SET NOT NULL`,
    );
  }
}
