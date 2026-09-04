import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContactSoftDelete1788516900000 implements MigrationInterface {
  name = 'ContactSoftDelete1788516900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "contact" ADD "deletedAt" TIMESTAMP');
    // Every contact read filters on "deletedAt" IS NULL, and live contacts are
    // the overwhelming majority — a partial index keeps that filter cheap
    // without indexing rows nobody reads.
    await queryRunner.query(
      'CREATE INDEX "IDX_contact_tenant_not_deleted" ON "contact" ("tenantId") WHERE "deletedAt" IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // "deletedAt" is the only record that a contact was deleted. Dropping the
    // column does not restore those contacts in a recoverable way — it erases
    // the deletion itself, so every soft-deleted person silently reappears in
    // listings, group rosters and reports. Refuse the revert instead, and make
    // the operator decide what should happen to them.
    const [{ count }] = await queryRunner.query(
      'SELECT COUNT(*)::int AS count FROM "contact" WHERE "deletedAt" IS NOT NULL',
    );

    if (count > 0) {
      throw new Error(
        `Refusing to revert ContactSoftDelete1788516900000: ${count} contact(s) are ` +
          'soft-deleted, and dropping "contact"."deletedAt" would restore them ' +
          'with no way to tell which ones were deleted.\n' +
          'List them with:\n' +
          '  SELECT id, "tenantId", "deletedAt" FROM "contact" WHERE "deletedAt" IS NOT NULL;\n' +
          'Then either hard-delete those rows, or deliberately restore them ' +
          '(SET "deletedAt" = NULL) once the restoration is approved, and re-run the revert.',
      );
    }

    await queryRunner.query(
      'DROP INDEX "public"."IDX_contact_tenant_not_deleted"',
    );
    await queryRunner.query('ALTER TABLE "contact" DROP COLUMN "deletedAt"');
  }
}
