import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Contact } from '../../src/crm/entities/contact.entity';
import { Person } from '../../src/crm/entities/person.entity';
import { Email } from '../../src/crm/entities/email.entity';
import { Phone } from '../../src/crm/entities/phone.entity';
import { Group } from '../../src/groups/entities/group.entity';
import { GroupMembership } from '../../src/groups/entities/groupMembership.entity';
import { User } from '../../src/users/entities/user.entity';
import { Tenant } from '../../src/tenants/entities/tenant.entity';
import { Report } from '../../src/reports/entities/report.entity';
import { ReportSubmission } from '../../src/reports/entities/report.submission.entity';
import { ContactCategory } from '../../src/crm/enums/contactCategory';
import { GroupRole } from '../../src/groups/enums/groupRole';
import { GroupPrivacy } from '../../src/groups/enums/groupPrivacy';
import { ReportFrequency } from '../../src/reports/enums/report.enum';

/**
 * Test Setup Utilities
 *
 * Helper functions for creating test data with proper relationships
 * and cleaning up after tests.
 */

let jwtService: JwtService;

export const initializeJwtService = (): JwtService => {
  if (!jwtService) {
    jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'test-jwt-secret',
    });
  }
  return jwtService;
};

export const createTestTenant = async (
  dataSource: DataSource,
  name: string,
  balance: number = 100000, // Default $1000 balance
): Promise<Tenant> => {
  const tenantRepo = dataSource.getRepository(Tenant);

  const tenant = tenantRepo.create({
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, '-')}.test.com`,
    isActive: true,
    balance,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return await tenantRepo.save(tenant);
};

export const createTestUser = async (
  dataSource: DataSource,
  role: string,
  tenantId: number,
  email?: string,
  password?: string,
): Promise<{ user: User; token: string }> => {
  const userRepo = dataSource.getRepository(User);

  const testEmail = email || `test-${Date.now()}@example.com`;
  const testPassword = password || 'TestPassword123!';

  const user = userRepo.create({
    username: testEmail.split('@')[0],
    email: testEmail,
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    tenant: { id: tenantId },
    // Add other required fields based on your User entity
  });

  // Hash password if your User entity has a password field
  if (user.setPassword) {
    await user.setPassword(testPassword);
  }

  const savedUser = await userRepo.save(user);

  // Generate JWT token
  const payload = {
    sub: savedUser.id,
    email: savedUser.email,
    userId: savedUser.id,
    tenantId: tenantId,
    userRole: role,
  };

  const token = jwtService.sign(payload);

  return { user: savedUser, token };
};

export const createTestGroup = async (
  dataSource: DataSource,
  tenantId: number,
  name: string,
  privacy: GroupPrivacy = GroupPrivacy.Open,
): Promise<Group> => {
  const groupRepo = dataSource.getRepository(Group);

  const group = groupRepo.create({
    name,
    privacy,
    tenant: { id: tenantId },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return await groupRepo.save(group);
};

export const createTestContact = async (
  dataSource: DataSource,
  tenantId: number,
  firstName: string = 'Test',
  lastName: string = 'Contact',
): Promise<Contact> => {
  const contactRepo = dataSource.getRepository(Contact);
  const personRepo = dataSource.getRepository(Person);

  // Create person first
  const person = personRepo.create({
    firstName,
    lastName,
    dateOfBirth: new Date('1990-01-01'),
  });
  const savedPerson = await personRepo.save(person);

  // Create contact
  const contact = contactRepo.create({
    category: ContactCategory.Person,
    tenant: { id: tenantId },
    person: savedPerson,
    isActive: true,
  });

  return await contactRepo.save(contact);
};

export const createTestGroupMembership = async (
  dataSource: DataSource,
  contactId: number,
  groupId: number,
  role: GroupRole = GroupRole.Member,
): Promise<GroupMembership> => {
  const membershipRepo = dataSource.getRepository(GroupMembership);

  const membership = membershipRepo.create({
    contact: { id: contactId },
    group: { id: groupId },
    role,
    isActive: true,
    joinedAt: new Date(),
  });

  return await membershipRepo.save(membership);
};

export const createTestReport = async (
  dataSource: DataSource,
  tenantId: number,
  title: string = 'Test Report',
  frequency: ReportFrequency = ReportFrequency.WEEKLY,
): Promise<Report> => {
  const reportRepo = dataSource.getRepository(Report);

  const report = reportRepo.create({
    title,
    frequency,
    tenant: { id: tenantId },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return await reportRepo.save(report);
};

export const createTestReportSubmission = async (
  dataSource: DataSource,
  reportId: number,
  contactId: number,
  groupId: number,
): Promise<ReportSubmission> => {
  const submissionRepo = dataSource.getRepository(ReportSubmission);

  const submission = submissionRepo.create({
    report: { id: reportId },
    contact: { id: contactId },
    group: { id: groupId },
    submissionDate: new Date(),
    isComplete: true,
  });

  return await submissionRepo.save(submission);
};

export const cleanupTestData = async (
  dataSource: DataSource,
): Promise<void> => {
  try {
    // Clean up in reverse order to handle foreign key constraints
    await dataSource.getRepository(ReportSubmission).delete({});
    await dataSource.getRepository(Report).delete({});
    await dataSource.getRepository(GroupMembership).delete({});
    await dataSource.getRepository(Group).delete({});
    await dataSource.getRepository(Email).delete({});
    await dataSource.getRepository(Phone).delete({});
    await dataSource.getRepository(Contact).delete({});
    await dataSource.getRepository(Person).delete({});
    await dataSource.getRepository(User).delete({});
    await dataSource.getRepository(Tenant).delete({});

    console.log('✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    // Don't throw error - cleanup issues shouldn't fail tests
  }
};

/**
 * Create a complete test setup with tenant, users, groups, and contacts
 */
export const createCompleteTestSetup = async (
  dataSource: DataSource,
  tenantName: string,
): Promise<{
  tenant: Tenant;
  owner: { user: User; token: string };
  group: Group;
  contact: Contact;
  membership: GroupMembership;
  report: Report;
}> => {
  // Create tenant
  const tenant = await createTestTenant(dataSource, tenantName);

  // Create owner user
  const owner = await createTestUser(dataSource, 'OWNER', tenant.id);

  // Create group
  const group = await createTestGroup(
    dataSource,
    tenant.id,
    `${tenantName} Group`,
  );

  // Create contact
  const contact = await createTestContact(dataSource, tenant.id);

  // Create group membership
  const membership = await createTestGroupMembership(
    dataSource,
    contact.id,
    group.id,
    GroupRole.Member,
  );

  // Create report
  const report = await createTestReport(dataSource, tenant.id);

  return {
    tenant,
    owner,
    group,
    contact,
    membership,
    report,
  };
};
