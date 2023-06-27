import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1687884848307 implements MigrationInterface {
  name = "InitialMigration1687884848307";

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
