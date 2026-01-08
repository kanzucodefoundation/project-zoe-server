import { DataSource } from 'typeorm';
import { Contact } from '../../src/crm/entities/contact.entity';
import { Person } from '../../src/crm/entities/person.entity';
import { Email } from '../../src/crm/entities/email.entity';
import { Phone } from '../../src/crm/entities/phone.entity';
import { Address } from '../../src/crm/entities/address.entity';
import { Group } from '../../src/groups/entities/group.entity';
import { GroupMembership } from '../../src/groups/entities/groupMembership.entity';
import { User } from '../../src/users/entities/user.entity';
import { Tenant } from '../../src/tenants/entities/tenant.entity';
import { Report } from '../../src/reports/entities/report.entity';
import { ReportSubmission } from '../../src/reports/entities/report.submission.entity';

/**
 * Test Database Configuration
 *
 * Sets up a separate test database to avoid affecting production data.
 * Uses actual PostgreSQL for realistic testing conditions.
 */

let testDataSource: DataSource;

export const initializeTestDatabase = async (): Promise<DataSource> => {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  testDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'test',
    password: process.env.DB_PASSWORD || 'test',
    database: process.env.DB_NAME_TEST || 'project_zoe_test',
    entities: [
      Contact,
      Person,
      Email,
      Phone,
      Address,
      Group,
      GroupMembership,
      User,
      Tenant,
      Report,
      ReportSubmission,
      // Add other entities as needed
    ],
    synchronize: true, // Use synchronize for tests, NOT for production
    dropSchema: false, // Don't drop schema automatically
    logging: process.env.TEST_DB_LOGGING === 'true',
  });

  if (!testDataSource.isInitialized) {
    await testDataSource.initialize();
  }

  return testDataSource;
};

export const closeTestDatabase = async (
  dataSource?: DataSource,
): Promise<void> => {
  const db = dataSource || testDataSource;
  if (db && db.isInitialized) {
    await db.destroy();
  }
};

export const clearTestDatabase = async (
  dataSource: DataSource,
): Promise<void> => {
  const entities = dataSource.entityMetadatas;

  // Clear tables in reverse order to handle foreign key constraints
  for (const entity of entities.reverse()) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE "${entity.tableName}" CASCADE`);
  }
};
