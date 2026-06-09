import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WhmReportsSeedService } from '../seed/whm/whm-reports.seed';
import { Logger } from '@nestjs/common';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(WhmReportsSeedService);

  try {
    await service.seedReports();
  } catch (error) {
    Logger.error('❌ WHM report seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

run();
