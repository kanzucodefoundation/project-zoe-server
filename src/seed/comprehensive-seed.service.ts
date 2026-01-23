import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository, TreeRepository } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Import entities
import { User } from 'src/users/entities/user.entity';
import Roles from 'src/users/entities/roles.entity';
import UserRoles from 'src/users/entities/userRoles.entity';
import Contact from 'src/crm/entities/contact.entity';
import Person from 'src/crm/entities/person.entity';
import Email from 'src/crm/entities/email.entity';
import Phone from 'src/crm/entities/phone.entity';
import Address from 'src/crm/entities/address.entity';
import Group from 'src/groups/entities/group.entity';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import { Report } from 'src/reports/entities/report.entity';
import { ReportField } from 'src/reports/entities/report.field.entity';
import { ReportSubmission } from 'src/reports/entities/report.submission.entity';
import { ReportSubmissionData } from 'src/reports/entities/report.submission.data.entity';
import { Tenant } from 'src/tenants/entities/tenant.entity';

// Import enums
import { ContactCategory } from 'src/crm/enums/contactCategory';
import { EmailCategory } from 'src/crm/enums/emailCategory';
import { PhoneCategory } from 'src/crm/enums/phoneCategory';
import { AddressCategory } from 'src/crm/enums/addressCategory';
import { GroupRole } from 'src/groups/enums/groupRole';
import { GroupPrivacy } from 'src/groups/enums/groupPrivacy';
import {
  ReportType,
  ReportFieldType,
  ReportSubmissionFrequency,
  ReportStatus,
} from 'src/reports/enums/report.enum';
import { FieldType } from 'src/reports/entities/report.field.entity';

// Import seed data
import { contactsData } from './data/seed-contacts';
import { groupsData } from './data/seed-groups';
import { reportsData } from './data/seed-reports';
import { submissionGenerators } from './data/seed-submissions';
import { TEST_USERS } from './data/test-users';

const hashCost = 10;

@Injectable()
export class ComprehensiveSeedService {
  private userRepository: Repository<User>;
  private rolesRepository: Repository<Roles>;
  private userRolesRepository: Repository<UserRoles>;
  private contactRepository: Repository<Contact>;
  private personRepository: Repository<Person>;
  private emailRepository: Repository<Email>;
  private phoneRepository: Repository<Phone>;
  private addressRepository: Repository<Address>;
  private groupRepository: Repository<Group>;
  private groupTreeRepository: TreeRepository<Group>;
  private groupCategoryRepository: Repository<GroupCategory>;
  private groupMembershipRepository: Repository<GroupMembership>;
  private reportRepository: Repository<Report>;
  private reportFieldRepository: Repository<ReportField>;
  private reportSubmissionRepository: Repository<ReportSubmission>;
  private reportSubmissionDataRepository: Repository<ReportSubmissionData>;
  private tenantRepository: Repository<Tenant>;

  constructor(@InjectConnection() private connection: Connection) {
    // Repositories will be initialized in initializeRepositories method
  }

  private initializeRepositories(): void {
    // Initialize repositories
    this.userRepository = this.connection.getRepository(User);
    this.rolesRepository = this.connection.getRepository(Roles);
    this.userRolesRepository = this.connection.getRepository(UserRoles);
    this.contactRepository = this.connection.getRepository(Contact);
    this.personRepository = this.connection.getRepository(Person);
    this.emailRepository = this.connection.getRepository(Email);
    this.phoneRepository = this.connection.getRepository(Phone);
    this.addressRepository = this.connection.getRepository(Address);
    this.groupRepository = this.connection.getRepository(Group);
    this.groupTreeRepository = this.connection.getTreeRepository(Group);
    this.groupCategoryRepository = this.connection.getRepository(GroupCategory);
    this.groupMembershipRepository =
      this.connection.getRepository(GroupMembership);
    this.reportRepository = this.connection.getRepository(Report);
    this.reportFieldRepository = this.connection.getRepository(ReportField);
    this.reportSubmissionRepository =
      this.connection.getRepository(ReportSubmission);
    this.reportSubmissionDataRepository =
      this.connection.getRepository(ReportSubmissionData);
    this.tenantRepository = this.connection.getRepository(Tenant);
  }

  async seedAll(): Promise<void> {
    Logger.log('🌱 Starting comprehensive database seeding...');

    try {
      // Initialize repositories first
      this.initializeRepositories();

      // Ensure default tenant exists
      await this.ensureDefaultTenant();

      // Seed in order of dependencies
      await this.seedRoles();
      await this.seedGroupCategories();
      await this.seedGroups();
      await this.seedContacts();
      await this.seedUsers();
      await this.seedGroupMemberships();
      await this.seedReports();
      await this.seedHistoricalSubmissions();

      Logger.log('✅ Database seeding completed successfully!');
    } catch (error) {
      Logger.error('❌ Error during database seeding:', error);
      throw error;
    }
  }

  async ensureDefaultTenant(): Promise<Tenant> {
    let tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    if (!tenant) {
      tenant = new Tenant();
      tenant.id = 1;
      tenant.name = 'worshipharvest';
      tenant.description = 'Default tenant for Worship Harvest Global';
      tenant = await this.tenantRepository.save(tenant);
      Logger.log('Created default tenant');
    }

    return tenant;
  }

  async seedRoles(): Promise<void> {
    Logger.log('🔐 Seeding roles...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    const defaultRoles = [
      {
        role: 'MC Shepherd',
        description: 'Missional Community Leader',
        permissions: ['REPORT_VIEW', 'REPORT_SUBMIT', 'CRM_VIEW', 'CRM_EDIT'],
        isActive: true,
      },
      {
        role: 'Zone Leader',
        description: 'Zone Level Leader',
        permissions: [
          'REPORT_VIEW',
          'REPORT_SUBMIT',
          'REPORT_VIEW_SUBMISSIONS',
          'CRM_VIEW',
          'CRM_EDIT',
          'GROUP_VIEW',
        ],
        isActive: true,
      },
      {
        role: 'Location Pastor',
        description: 'Location Level Pastor',
        permissions: [
          'REPORT_VIEW',
          'REPORT_SUBMIT',
          'REPORT_VIEW_SUBMISSIONS',
          'CRM_VIEW',
          'CRM_EDIT',
          'GROUP_VIEW',
          'GROUP_EDIT',
        ],
        isActive: true,
      },
      {
        role: 'FOB Leader',
        description: 'Forward Operating Base Leader',
        permissions: [
          'REPORT_VIEW',
          'REPORT_SUBMIT',
          'REPORT_VIEW_SUBMISSIONS',
          'CRM_VIEW',
          'CRM_EDIT',
          'GROUP_VIEW',
          'GROUP_EDIT',
        ],
        isActive: true,
      },
      {
        role: 'Network Leader',
        description: 'Network Level Leader',
        permissions: [
          'REPORT_VIEW',
          'REPORT_SUBMIT',
          'REPORT_VIEW_SUBMISSIONS',
          'CRM_VIEW',
          'CRM_EDIT',
          'GROUP_VIEW',
          'GROUP_EDIT',
          'USER_VIEW',
        ],
        isActive: true,
      },
      {
        role: 'Movement Leader',
        description: 'Movement Level Leader',
        permissions: [
          'REPORT_VIEW',
          'REPORT_SUBMIT',
          'REPORT_VIEW_SUBMISSIONS',
          'CRM_VIEW',
          'CRM_EDIT',
          'GROUP_VIEW',
          'GROUP_EDIT',
          'USER_VIEW',
          'USER_EDIT',
        ],
        isActive: true,
      },
      {
        role: 'RoleAdmin',
        description: 'System Administrator',
        permissions: [
          'ROLE_EDIT',
          'USER_VIEW',
          'USER_EDIT',
          'GROUP_EDIT',
          'GROUP_VIEW',
          'EVENT_EDIT',
          'EVENT_VIEW',
          'REPORT_VIEW_SUBMISSIONS',
          'DASHBOARD',
          'CRM_VIEW',
          'CRM_EDIT',
          'TAG_VIEW',
          'TAG_EDIT',
          'REPORT_VIEW',
          'REPORT_EDIT',
          'REPORT_SUBMIT',
        ],
        isActive: true,
      },
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await this.rolesRepository.findOne({
        where: { role: roleData.role },
      });
      if (!existingRole) {
        const role = new Roles();
        Object.assign(role, roleData);
        role.tenant = tenant;
        await this.rolesRepository.save(role);
        Logger.log(`Created role: ${roleData.role}`);
      }
    }
  }

  async seedGroupCategories(): Promise<void> {
    Logger.log('📂 Seeding group categories...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    const categories = [
      { id: 1, name: 'Missional Community' },
      { id: 2, name: 'Zone' },
      { id: 3, name: 'Location' },
      { id: 4, name: 'Forward Operating Base' },
      { id: 5, name: 'Network' },
      { id: 6, name: 'Movement' },
    ];

    for (const catData of categories) {
      const existing = await this.groupCategoryRepository.findOne({
        where: { name: catData.name },
      });
      if (!existing) {
        const category = new GroupCategory();
        category.id = catData.id;
        category.name = catData.name;
        category.tenant = tenant;
        await this.groupCategoryRepository.save(category);
        Logger.log(`Created category: ${catData.name}`);
      }
    }
  }

  async seedGroups(): Promise<void> {
    Logger.log('🏢 Seeding groups hierarchy...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    // Seed all groups in hierarchical order
    const allGroups = [
      groupsData.movement,
      ...groupsData.networks,
      ...groupsData.fobs,
      ...groupsData.locations,
      ...groupsData.zones,
      ...groupsData.fellowships,
    ];

    for (const groupData of allGroups) {
      const existing = await this.groupRepository.findOne({
        where: { id: groupData.id },
      });
      if (!existing) {
        const group = new Group();
        group.id = groupData.id;
        group.name = groupData.name;
        group.details = groupData.details;
        group.privacy =
          groupData.privacy === 'Public'
            ? GroupPrivacy.Public
            : GroupPrivacy.Private;
        group.tenant = tenant;
        if ((groupData as any).metaData) {
          group.metaData = (groupData as any).metaData;
        }
        if ((groupData as any).address) {
          group.address = (groupData as any).address;
        }

        // Set category
        const category = await this.groupCategoryRepository.findOne({
          where: { id: groupData.categoryId },
        });
        if (category) {
          group.category = category;
        }

        // Set parent if exists
        if (groupData.parentId) {
          const parent = await this.groupRepository.findOne({
            where: { id: groupData.parentId },
          });
          if (parent) {
            group.parent = parent;
          }
        }

        await this.groupRepository.save(group);
        Logger.log(`Created group: ${groupData.name}`);
      }
    }
  }

  async seedContacts(): Promise<void> {
    Logger.log('👥 Seeding contacts...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    for (const contactData of contactsData) {
      const existing = await this.contactRepository.findOne({
        where: { id: contactData.id },
      });
      if (!existing) {
        // Create contact first (without person)
        const contact = new Contact();
        contact.id = contactData.id;
        contact.category = ContactCategory.Person;
        contact.tenant = tenant;
        const savedContact = await this.contactRepository.save(contact);

        // Create person with contactId
        const person = new Person();
        person.firstName = contactData.firstName;
        person.lastName = contactData.lastName;
        person.gender = contactData.gender as any;
        person.ageGroup = contactData.ageGroup;
        person.dateOfBirth = contactData.dateOfBirth
          ? new Date(contactData.dateOfBirth)
          : null;
        person.civilStatus = contactData.civilStatus as any;
        person.placeOfWork = contactData.placeOfWork;
        person.contactId = savedContact.id;
        await this.personRepository.save(person);

        // Update contact with person reference
        savedContact.person = person;
        await this.contactRepository.save(savedContact);

        // Create email if exists
        if (contactData.email) {
          const email = new Email();
          email.category = EmailCategory.Personal;
          email.value = contactData.email;
          email.isPrimary = true;
          email.contact = savedContact;
          await this.emailRepository.save(email);
        }

        // Create phone
        const phone = new Phone();
        phone.category = PhoneCategory.Mobile;
        phone.value = contactData.phone;
        phone.isPrimary = true;
        phone.contact = savedContact;
        await this.phoneRepository.save(phone);

        // Create address
        const address = new Address();
        address.category = AddressCategory.Home;
        address.country = contactData.country;
        address.district = contactData.district;
        address.freeForm = contactData.freeForm || '';
        address.isPrimary = true;
        address.contact = savedContact;
        await this.addressRepository.save(address);

        Logger.log(
          `Created contact: ${contactData.firstName} ${contactData.lastName} (ID: ${savedContact.id})`,
        );
      }
    }
  }

  async seedUsers(): Promise<void> {
    Logger.log('👤 Seeding test users...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    // Get the first 7 contacts to assign one to each test user
    const availableContacts = await this.contactRepository.find({
      relations: ['person'],
      order: { id: 'ASC' },
      take: 7,
    });

    if (availableContacts.length < TEST_USERS.length) {
      Logger.error(
        `Not enough contacts found! Need ${TEST_USERS.length}, found ${availableContacts.length}`,
      );
      return;
    }

    Logger.log(`Using ${availableContacts.length} contacts for test users`);

    for (let i = 0; i < TEST_USERS.length; i++) {
      const userData = TEST_USERS[i];
      const contact = availableContacts[i];
      const existing = await this.userRepository.findOne({
        where: { username: userData.username },
      });

      if (!existing) {
        const user = new User();
        user.id = userData.id;
        user.username = userData.username;
        user.password = bcrypt.hashSync(userData.password, hashCost);
        user.contactId = contact.id;
        user.isActive = userData.isActive;
        user.tenant = tenant;
        await this.userRepository.save(user);

        // Create user roles
        for (const roleName of userData.roles) {
          const role = await this.rolesRepository.findOne({
            where: { role: roleName },
          });
          if (role) {
            const userRole = new UserRoles();
            userRole.user = user;
            userRole.roles = role;
            await this.userRolesRepository.save(userRole);
          }
        }

        Logger.log(
          `Created user: ${userData.username} (Contact: ${contact.person?.firstName} ${contact.person?.lastName})`,
        );
      }
    }
  }

  async seedGroupMemberships(): Promise<void> {
    Logger.log('🤝 Seeding group memberships...');

    for (const contactData of contactsData) {
      const contact = await this.contactRepository.findOne({
        where: { id: contactData.id },
      });
      const group = await this.groupRepository.findOne({
        where: { id: contactData.groupId },
      });

      if (contact && group) {
        const existing = await this.groupMembershipRepository.findOne({
          where: { contactId: contact.id, groupId: group.id },
        });

        if (!existing) {
          const membership = new GroupMembership();
          membership.contact = contact;
          membership.contactId = contact.id;
          membership.group = group;
          membership.groupId = group.id;
          membership.role =
            contactData.role === 'Leader' || contactData.role === 'Co-Leader'
              ? GroupRole.Leader
              : GroupRole.Member;
          await this.groupMembershipRepository.save(membership);
        }
      }
    }
  }

  async seedReports(): Promise<void> {
    Logger.log('📊 Seeding reports...');

    const tenant = await this.tenantRepository.findOne({
      where: { name: 'worshipharvest' },
    });

    for (const reportData of reportsData) {
      const existing = await this.reportRepository.findOne({
        where: { id: reportData.id },
      });
      if (!existing) {
        const report = new Report();
        report.id = reportData.id;
        report.name = reportData.name;
        report.description = reportData.description;
        report.submissionFrequency =
          reportData.submissionFrequency as ReportSubmissionFrequency;
        report.active = reportData.active;
        report.status = reportData.status as ReportStatus;
        report.tenant = tenant;

        // Set user (use admin user for now)
        const adminUser = await this.userRepository.findOne({
          where: { username: 'admin@worshipharvest.org' },
        });
        if (adminUser) {
          report.user = adminUser;
        }

        await this.reportRepository.save(report);

        // Create report fields
        for (const fieldData of reportData.fields) {
          const field = new ReportField();
          field.id = fieldData.id;
          field.name = fieldData.name;
          // Map field types to entity enum
          const fieldTypeMap = {
            text: FieldType.TEXT,
            textarea: FieldType.TEXTAREA,
            number: FieldType.NUMBER,
            date: FieldType.DATE,
            datetime: FieldType.DATETIME,
            select: FieldType.SELECT,
          };
          field.type = fieldTypeMap[fieldData.type] || FieldType.TEXT;
          field.label = fieldData.label;
          field.required = fieldData.required;
          field.hidden = fieldData.hidden;
          field.options = fieldData.options;
          // Note: order field not available in current entity
          field.report = report;
          await this.reportFieldRepository.save(field);
        }

        Logger.log(`Created report: ${reportData.name}`);
      }
    }
  }

  async seedHistoricalSubmissions(): Promise<void> {
    Logger.log('📈 Seeding historical submissions...');

    // Generate MC submissions
    const mcSubmissions = submissionGenerators.generateMCSubmissions();
    await this.createSubmissions(mcSubmissions);

    // Generate service submissions
    const serviceSubmissions =
      submissionGenerators.generateServiceSubmissions();
    await this.createSubmissions(serviceSubmissions);

    // Generate baptism submissions
    const baptismSubmissions =
      submissionGenerators.generateBaptismSubmissions();
    await this.createSubmissions(baptismSubmissions);

    // Generate salvation submissions
    const salvationSubmissions =
      submissionGenerators.generateSalvationSubmissions();
    await this.createSubmissions(salvationSubmissions);

    Logger.log(
      `Created ${
        mcSubmissions.length +
        serviceSubmissions.length +
        baptismSubmissions.length +
        salvationSubmissions.length
      } historical submissions`,
    );
  }

  private async createSubmissions(submissions: any[]): Promise<void> {
    for (const submissionData of submissions) {
      const existing = await this.reportSubmissionRepository.findOne({
        where: { id: submissionData.id },
      });
      if (!existing) {
        const submission = new ReportSubmission();
        submission.id = submissionData.id;
        submission.submittedAt = new Date(submissionData.submittedAt);

        // Set report
        const report = await this.reportRepository.findOne({
          where: { id: submissionData.reportId },
        });
        if (report) {
          submission.report = report;
        }

        // Set group
        const group = await this.groupRepository.findOne({
          where: { id: submissionData.groupId },
        });
        if (group) {
          submission.group = group;
        }

        // Set user (use admin user for now)
        const adminUser = await this.userRepository.findOne({
          where: { username: 'admin@worshipharvest.org' },
        });
        if (adminUser) {
          submission.user = adminUser;
        }

        await this.reportSubmissionRepository.save(submission);

        // Create submission data
        if (submissionData.data) {
          for (const [fieldName, fieldValue] of Object.entries(
            submissionData.data,
          )) {
            const reportField = await this.reportFieldRepository.findOne({
              where: {
                name: fieldName,
                report: { id: submissionData.reportId },
              },
            });

            if (reportField) {
              const submissionDataEntry = new ReportSubmissionData();
              submissionDataEntry.fieldValue = String(fieldValue);
              submissionDataEntry.reportSubmission = submission;
              submissionDataEntry.reportField = reportField;
              await this.reportSubmissionDataRepository.save(
                submissionDataEntry,
              );
            }
          }
        }
      }
    }
  }

  async clearAll(): Promise<void> {
    Logger.log('🧹 Clearing all seeded data...');

    // Initialize repositories first
    this.initializeRepositories();

    // Clear in reverse order of dependencies
    await this.reportSubmissionDataRepository.delete({});
    await this.reportSubmissionRepository.delete({});
    await this.reportFieldRepository.delete({});
    await this.reportRepository.delete({});
    await this.groupMembershipRepository.delete({});
    await this.userRolesRepository.delete({});
    await this.userRepository.delete({});
    await this.addressRepository.delete({});
    await this.phoneRepository.delete({});
    await this.emailRepository.delete({});
    await this.contactRepository.delete({});
    await this.personRepository.delete({});
    await this.groupRepository.delete({});
    await this.groupCategoryRepository.delete({});
    await this.rolesRepository.delete({});

    Logger.log('✅ All data cleared');
  }
}
