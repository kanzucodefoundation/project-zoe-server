import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `CREATE INDEX IF NOT EXISTS` lets `up()` succeed when the index is already
 * present, so `down()` must not drop it unconditionally — that would remove an
 * index this migration never created. The index is stamped with a comment
 * naming this migration when it is genuinely created here, and `down()` drops
 * it only when that stamp is present.
 */
export class GroupMembershipGroupIdIsActiveContactIdIndex1784897629557
  implements MigrationInterface
{
  name = 'GroupMembershipGroupIdIsActiveContactIdIndex1784897629557';

  private static readonly MARKER =
    'created-by:GroupMembershipGroupIdIsActiveContactIdIndex1784897629557';

  private static readonly INDEX = 'IDX_70871bc95820363218c334143b';

  private async indexComment(
    queryRunner: QueryRunner,
  ): Promise<string | null | undefined> {
    const rows = await queryRunner.query(
      `SELECT obj_description(c.oid, 'pg_class') AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [GroupMembershipGroupIdIsActiveContactIdIndex1784897629557.INDEX],
    );
    return rows.length > 0 ? rows[0].comment : undefined;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const preexisted = (await this.indexComment(queryRunner)) !== undefined;

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_70871bc95820363218c334143b" ON "group_membership" ("groupId", "isActive", "contactId")',
    );

    if (!preexisted) {
      await queryRunner.query(
        `COMMENT ON INDEX "public"."IDX_70871bc95820363218c334143b" IS '${GroupMembershipGroupIdIsActiveContactIdIndex1784897629557.MARKER}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const comment = await this.indexComment(queryRunner);
    if (
      comment ===
      GroupMembershipGroupIdIsActiveContactIdIndex1784897629557.MARKER
    ) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_70871bc95820363218c334143b"',
      );
    }
  }
}
