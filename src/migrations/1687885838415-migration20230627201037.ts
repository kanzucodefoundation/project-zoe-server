import { MigrationInterface, QueryRunner } from "typeorm";

export class migration202306272010371687885838415
  implements MigrationInterface {
  name = "migration202306272010371687885838415";

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
