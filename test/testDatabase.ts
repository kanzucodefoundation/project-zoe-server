import { TypeOrmModule } from '@nestjs/typeorm';
import config from '../src/config';

import { appEntities } from '../src/app.module';

export const testDatabase = TypeOrmModule.forRoot({
  type: 'postgres',
  ...config.database,
  entities: [...appEntities],
  logging: true,
});
