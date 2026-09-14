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
    // Refuse rather than invent. Stamping every unknown gender with a value to
    // satisfy the constraint would write false data about real people, and a
    // rollback is not a licence to do that. Whoever reverts has to decide what
    // those records should say first.
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "person" WHERE "gender" IS NULL`,
    );

    if (count > 0) {
      throw new Error(
        `Cannot restore NOT NULL on person.gender: ${count} people have no ` +
          'gender recorded. Set a value for those records, then re-run this ' +
          'revert. They are people imported from QuickBooks, which does not ' +
          'carry a gender field.',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "person" ALTER COLUMN "gender" SET NOT NULL`,
    );
  }
}
