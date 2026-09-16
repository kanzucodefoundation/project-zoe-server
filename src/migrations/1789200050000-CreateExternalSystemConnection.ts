import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExternalSystemConnection1789200050000
  implements MigrationInterface
{
  name = 'CreateExternalSystemConnection1789200050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "external_system_connection" (
        "id"                     SERIAL PRIMARY KEY,
        "tenantId"               integer NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
        "system"                 character varying(50) NOT NULL,
        "environment"            character varying(20) NOT NULL,
        "realmId"                character varying(100),
        "accessToken"            text NOT NULL,
        "refreshToken"           text NOT NULL,
        "accessTokenExpiresAt"   timestamptz NOT NULL,
        "refreshTokenExpiresAt"  timestamptz NOT NULL,
        "createdAt"              timestamptz NOT NULL DEFAULT now(),
        "updatedAt"              timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_esc_tenant_system"
      ON "external_system_connection" ("tenantId", "system")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."UQ_esc_tenant_system"',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "external_system_connection"',
    );
  }
}
