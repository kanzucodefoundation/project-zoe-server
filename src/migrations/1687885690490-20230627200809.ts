import { MigrationInterface, QueryRunner } from "typeorm";

export class test202306272008091687885690490 implements MigrationInterface {
  name = "test202306272008091687885690490";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_submission" ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_submission" ALTER COLUMN "submittedAt" SET DEFAULT now()`,
    );
  }
}
