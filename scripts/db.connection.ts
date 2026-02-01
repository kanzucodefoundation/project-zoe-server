import { createConnection } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../src/tenants/entities/tenant.entity';
import { appEntities } from 'src/config';

dotenv.config();

export async function getConnection() {
  return createConnection({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl:
      process.env.DB_PORT === '25060'
        ? { rejectUnauthorized: false }
        : undefined,
    schema: 'public',
    entities: [...appEntities, Tenant],
    synchronize: false, // IMPORTANT: never sync in scripts
    logging: false,
  });
}
