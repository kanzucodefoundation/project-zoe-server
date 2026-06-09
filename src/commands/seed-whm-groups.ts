import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WhmGroupTreeSeedService } from '../seed/whm/whm-group-tree.seed';
import { Logger } from '@nestjs/common';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(WhmGroupTreeSeedService);

  try {
    await service.seedGroupTree();
  } catch (error) {
    Logger.error('❌ WHM group tree seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

run();
