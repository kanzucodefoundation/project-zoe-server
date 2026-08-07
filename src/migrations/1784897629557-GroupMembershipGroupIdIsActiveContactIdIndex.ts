import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupMembershipGroupIdIsActiveContactIdIndex1784897629557
  implements MigrationInterface
{
  name = 'GroupMembershipGroupIdIsActiveContactIdIndex1784897629557';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX CONCURRENTLY "IDX_70871bc95820363218c334143b" ON "group_membership" ("groupId", "isActive", "contactId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX CONCURRENTLY "public"."IDX_70871bc95820363218c334143b"',
    );
  }
}
