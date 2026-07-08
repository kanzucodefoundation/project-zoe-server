import { DataSource } from 'typeorm';
import { appEntities } from './config';
import { Tenant } from './tenants/entities/tenant.entity';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl:
    process.env.DB_PORT === '25060' ? { rejectUnauthorized: false } : undefined,
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [...appEntities, Tenant],
  migrations: ['src/migrations/*.ts'],
});
