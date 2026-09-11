import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExternalSystemMapping1789100259773
  implements MigrationInterface
{
  name = 'CreateExternalSystemMapping1789100259773';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "external_system_mapping" (
        "id"                    SERIAL PRIMARY KEY,
        "tenantId"              integer NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
        "system"                character varying(50) NOT NULL,
        "internalReferenceType" character varying(50) NOT NULL,
        "internalReferenceId"   character varying(100) NOT NULL,
        "externalReferenceType" character varying(50) NOT NULL,
        "externalReferenceId"   character varying(100) NOT NULL,
        "externalReferenceName" character varying(255),
        "metadata"              jsonb,
        "lastSyncedAt"          timestamptz,
        "createdAt"             timestamptz NOT NULL DEFAULT now(),
        "updatedAt"             timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Prevent duplicate mappings for the same internal→externalType combination
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_esm_tenant_system_internal_ext_type"
      ON "external_system_mapping"
        ("tenantId", "system", "internalReferenceType", "internalReferenceId", "externalReferenceType")
    `);

    // Fast lookups by external ID
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_esm_tenant_system_external"
      ON "external_system_mapping" ("tenantId", "system", "externalReferenceType", "externalReferenceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_esm_tenant_system_external"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_esm_tenant_system_internal_ext_type"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "external_system_mapping"');
  }
}
