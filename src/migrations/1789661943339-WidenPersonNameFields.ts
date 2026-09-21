import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenPersonNameFields1789661943339 implements MigrationInterface {
  name = 'WidenPersonNameFields1789661943339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "firstName" TYPE character varying(100)',
    );
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "lastName" TYPE character varying(100)',
    );
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "middleName" TYPE character varying(100)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "firstName" TYPE character varying(40)',
    );
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "lastName" TYPE character varying(40)',
    );
    await queryRunner.query(
      'ALTER TABLE "person" ALTER COLUMN "middleName" TYPE character varying(40)',
    );
  }
}
