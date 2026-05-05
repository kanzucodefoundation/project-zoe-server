import { Injectable, Inject, Logger } from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import Contact from '../crm/entities/contact.entity';
import Person from '../crm/entities/person.entity';
import Phone from '../crm/entities/phone.entity';
import Email from '../crm/entities/email.entity';
import Address from '../crm/entities/address.entity';
import { User } from '../users/entities/user.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskComment } from '../tasks/entities/task-comment.entity';
import { ContactActivity } from '../crm/entities/contact-activity.entity';
import { ContactActivityService } from '../crm/contact-activity.service';
import { TenantContext } from '../shared/tenant/tenant-context';
import { normalizePhone } from '../finance/finance.helpers';
import { parseGender } from '../crm/utils/importUtils';
import { ContactCategory } from '../crm/enums/contactCategory';
import { Gender } from '../crm/enums/gender';
import { PhoneCategory } from '../crm/enums/phoneCategory';
import { EmailCategory } from '../crm/enums/emailCategory';
import { AddressCategory } from '../crm/enums/addressCategory';
import { GroupCategoryNames } from '../groups/enums/groups';
import { TaskType } from '../tasks/enums/task-type.enum';
import { TaskStatus } from '../tasks/enums/task-status.enum';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';

export interface BulkRowResult {
  row: number;
  name: string;
  status: 'created' | 'linked' | 'error';
  error?: string;
}

export interface BulkUploadSummary {
  total: number;
  created: number;
  linked: number;
  errors: BulkRowResult[];
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseRows(file: Express.Multer.File): Record<string, string>[] {
  return parse(file.buffer, {
    columns: (headers: string[]) => headers.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function col(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const val = row[name.toLowerCase()];
    if (val !== undefined && val.trim() !== '') return val.trim();
  }
  return '';
}

function parseDate(value: string): { date: Date; warning?: string } {
  if (!value || !value.trim()) return { date: new Date() };

  const trimmed = value.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00`);
    if (!isNaN(d.getTime())) return { date: d };
  }

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/').map(Number);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return { date: d };
  }

  return {
    date: new Date(),
    warning: `Could not parse date "${value}", defaulted to today`,
  };
}

function buildComment(...parts: Array<string | undefined>): string | undefined {
  const lines = parts.filter((part) => !!part?.trim());
  return lines.length > 0 ? lines.join('\n') : undefined;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ServiceRecordingService {
  private readonly contactRepository: Repository<Contact>;
  private readonly personRepository: Repository<Person>;
  private readonly phoneRepository: Repository<Phone>;
  private readonly emailRepository: Repository<Email>;
  private readonly addressRepository: Repository<Address>;
  private readonly userRepository: Repository<User>;
  private readonly groupMembershipRepository: Repository<GroupMembership>;
  private readonly taskRepository: Repository<Task>;
  private readonly taskCommentRepository: Repository<TaskComment>;

  constructor(
    @Inject('CONNECTION') private readonly connection: Connection,
    private readonly tenantContext: TenantContext,
    private readonly contactActivityService: ContactActivityService,
  ) {
    this.contactRepository = connection.getRepository(Contact);
    this.personRepository = connection.getRepository(Person);
    this.phoneRepository = connection.getRepository(Phone);
    this.emailRepository = connection.getRepository(Email);
    this.addressRepository = connection.getRepository(Address);
    this.userRepository = connection.getRepository(User);
    this.groupMembershipRepository = connection.getRepository(GroupMembership);
    this.taskRepository = connection.getRepository(Task);
    this.taskCommentRepository = connection.getRepository(TaskComment);
  }

  // -------------------------------------------------------------------------
  // Step 1: resolve uploader's church location
  // -------------------------------------------------------------------------

  async getChurchLocation(
    userId: number,
    tenantId: number,
  ): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

    const memberships = await this.groupMembershipRepository.find({
      where: { contactId: user.contactId, isActive: true },
      relations: ['group', 'group.category'],
    });

    const locationMemberships = memberships.filter(
      (m) => m.group?.category?.name === GroupCategoryNames.LOCATION,
    );

    return locationMemberships.length === 1
      ? locationMemberships[0].group.name
      : null;
  }

  // -------------------------------------------------------------------------
  // Shared: find existing contact by phone or create a new one
  // -------------------------------------------------------------------------

  private async resolveContact(
    tenantId: number,
    userId: number,
    firstName: string,
    lastName: string,
    rawPhone: string,
    rawEmail: string,
    rawAddress: string,
    rawGender: string,
    bornAgainOn?: Date | null,
  ): Promise<{ contact: Contact; isNew: boolean }> {
    const normalised = normalizePhone(rawPhone);

    // Duplicate check
    const existing = await this.phoneRepository
      .createQueryBuilder('phone')
      .innerJoinAndSelect('phone.contact', 'contact')
      .innerJoin('contact.tenant', 'tenant')
      .where('phone.value = :phone', { phone: normalised })
      .andWhere('tenant.id = :tenantId', { tenantId })
      .getOne();

    if (existing) {
      return { contact: existing.contact, isNew: false };
    }

    // Create Contact
    const contact = this.contactRepository.create({
      tenant: { id: tenantId } as any,
      category: ContactCategory.Person,
    });
    const savedContact = await this.contactRepository.save(contact);

    // Create Person
    const person = this.personRepository.create({
      firstName,
      lastName,
      gender: parseGender(rawGender) ?? Gender.Male,
      contactId: savedContact.id,
      bornAgainOn: bornAgainOn ?? null,
    } as any);
    await this.personRepository.save(person);

    // Create Phone
    const phone = this.phoneRepository.create({
      value: normalised || rawPhone,
      isPrimary: true,
      category: PhoneCategory.Mobile,
      contactId: savedContact.id,
    });
    await this.phoneRepository.save(phone);

    // Optional Email
    if (rawEmail) {
      const email = this.emailRepository.create({
        value: rawEmail,
        isPrimary: true,
        category: EmailCategory.Personal,
        contactId: savedContact.id,
      });
      await this.emailRepository.save(email);
    }

    // Optional Address
    if (rawAddress) {
      const address = this.addressRepository.create({
        category: AddressCategory.Home,
        isPrimary: true,
        country: '',
        district: '',
        freeForm: rawAddress,
        contactId: savedContact.id,
      });
      await this.addressRepository.save(address);
    }

    return { contact: savedContact, isNew: true };
  }

  // -------------------------------------------------------------------------
  // Shared: create a CALL task for the contact
  // -------------------------------------------------------------------------

  private async createFollowUpTask(
    tenantId: number,
    userId: number,
    contactId: number,
    title: string,
    prayerOrNotes?: string,
  ): Promise<Task> {
    const task = this.taskRepository.create({
      tenant: { id: tenantId } as any,
      contact: { id: contactId } as any,
      type: TaskType.CALL,
      title,
      status: TaskStatus.TODO,
      assignedTo: null,
      createdBy: { id: userId } as any,
    });
    const savedTask = await this.taskRepository.save(task);

    if (prayerOrNotes) {
      const comment = this.taskCommentRepository.create({
        task: { id: savedTask.id } as any,
        author: { id: userId } as any,
        body: prayerOrNotes,
      });
      await this.taskCommentRepository.save(comment);
    }

    return savedTask;
  }

  // -------------------------------------------------------------------------
  // Step 2: Guests bulk upload
  // -------------------------------------------------------------------------

  async bulkUploadGuests(
    tenantId: number,
    userId: number,
    file: Express.Multer.File,
  ): Promise<BulkUploadSummary> {
    const defaultLocation = await this.getChurchLocation(userId, tenantId);
    const rows = parseRows(file);

    const results: BulkRowResult[] = [];
    let created = 0;
    let linked = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // 1-based + header row
      const firstName = col(row, 'first name');
      const lastName = col(row, 'last name');
      const rawPhone = col(row, 'phone');
      const name = `${firstName} ${lastName}`.trim();

      try {
        // Validate required fields
        if (!firstName || !lastName || !rawPhone) {
          results.push({
            row: rowNumber,
            name: name || `Row ${rowNumber}`,
            status: 'error',
            error: 'Missing required field(s): First Name, Last Name, Phone',
          });
          continue;
        }

        const rawEmail = col(row, 'email');
        const rawAddress = col(row, 'address');
        const rawGender = col(row, 'gender');
        const prayerRequest = col(row, 'how may we pray for you');
        const locationOverride = col(row, 'church location');
        const rawServiceDate = col(row, 'service date');

        const { date: serviceDate, warning: dateWarning } =
          parseDate(rawServiceDate);
        const location = locationOverride || defaultLocation;

        const { contact, isNew } = await this.resolveContact(
          tenantId,
          userId,
          firstName,
          lastName,
          rawPhone,
          rawEmail,
          rawAddress,
          rawGender,
        );

        const taskTitle = `FTG Follow up — ${firstName} ${lastName} - ${rawPhone}`;
        const prayerComment = prayerRequest
          ? `Prayer request: ${prayerRequest}`
          : undefined;
        const task = await this.createFollowUpTask(
          tenantId,
          userId,
          contact.id,
          taskTitle,
          prayerComment,
        );

        const summaryParts: string[] = ['Recorded as first-time guest'];
        if (rawServiceDate) summaryParts.push(`on ${rawServiceDate}`);
        if (location) summaryParts.push(`at ${location}`);
        if (dateWarning) summaryParts.push(`(${dateWarning})`);

        await this.contactActivityService.record({
          tenantId,
          contactId: contact.id,
          type: ContactActivityType.FIRST_VISIT,
          summary: summaryParts.join(' '),
          occurredAt: serviceDate,
          recordedById: userId,
          referenceTable: 'task',
          referenceId: task.id,
        });

        if (isNew) created++;
        else linked++;

        results.push({
          row: rowNumber,
          name,
          status: isNew ? 'created' : 'linked',
          ...(dateWarning ? { error: dateWarning } : {}),
        });
      } catch (err) {
        Logger.error(`Guests bulk row ${rowNumber}: ${err.message}`);
        results.push({
          row: rowNumber,
          name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return {
      total: rows.length,
      created,
      linked,
      errors: results.filter((r) => r.status === 'error'),
    };
  }

  // -------------------------------------------------------------------------
  // Step 3: New believers bulk upload
  // -------------------------------------------------------------------------

  async bulkUploadBelievers(
    tenantId: number,
    userId: number,
    file: Express.Multer.File,
  ): Promise<BulkUploadSummary> {
    const rows = parseRows(file);

    const results: BulkRowResult[] = [];
    let created = 0;
    let linked = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const firstName = col(row, 'first name');
      const lastName = col(row, 'last name');
      const rawPhone = col(row, 'phone');
      const name = `${firstName} ${lastName}`.trim();

      try {
        if (!firstName || !lastName || !rawPhone) {
          results.push({
            row: rowNumber,
            name: name || `Row ${rowNumber}`,
            status: 'error',
            error: 'Missing required field(s): First Name, Last Name, Phone',
          });
          continue;
        }

        const rawEmail = col(row, 'email');
        const rawAddress = col(row, 'address');
        const rawGender = col(row, 'gender');
        const ledToChristBy = col(row, 'led to christ by');
        const rawLedToChristOn = col(row, 'led to christ on');
        const notes = col(row, 'notes');

        const { date: ledToChristOn, warning: dateWarning } =
          parseDate(rawLedToChristOn);

        const { contact, isNew } = await this.resolveContact(
          tenantId,
          userId,
          firstName,
          lastName,
          rawPhone,
          rawEmail,
          rawAddress,
          rawGender,
          ledToChristOn, // bornAgainOn
        );

        // If linked (existing contact), update bornAgainOn if not already set
        if (!isNew && ledToChristOn) {
          await this.personRepository.update({ contactId: contact.id }, {
            bornAgainOn: ledToChristOn,
          } as any);
        }

        const taskTitle = `New Believer Follow up — ${firstName} ${lastName} - ${rawPhone}`;
        const notesComment = notes ? notes : undefined;
        const task = await this.createFollowUpTask(
          tenantId,
          userId,
          contact.id,
          taskTitle,
          notesComment,
        );

        const summaryParts: string[] = ['Gave their life to Christ'];
        if (rawLedToChristOn) summaryParts.push(`on ${rawLedToChristOn}`);
        if (ledToChristBy) summaryParts.push(`, led by ${ledToChristBy}`);
        if (dateWarning) summaryParts.push(`(${dateWarning})`);

        await this.contactActivityService.record({
          tenantId,
          contactId: contact.id,
          type: ContactActivityType.GOT_SAVED,
          summary: summaryParts.join(''),
          occurredAt: ledToChristOn,
          recordedById: userId,
          referenceTable: 'task',
          referenceId: task.id,
        });

        if (isNew) created++;
        else linked++;

        results.push({
          row: rowNumber,
          name,
          status: isNew ? 'created' : 'linked',
          ...(dateWarning ? { error: dateWarning } : {}),
        });
      } catch (err) {
        Logger.error(`Believers bulk row ${rowNumber}: ${err.message}`);
        results.push({
          row: rowNumber,
          name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return {
      total: rows.length,
      created,
      linked,
      errors: results.filter((r) => r.status === 'error'),
    };
  }

  // -------------------------------------------------------------------------
  // Step 4: Red Zone bulk upload
  // -------------------------------------------------------------------------

  async bulkUploadRedZone(
    tenantId: number,
    userId: number,
    file: Express.Multer.File,
  ): Promise<BulkUploadSummary> {
    const defaultLocation = await this.getChurchLocation(userId, tenantId);
    const rows = parseRows(file);

    const results: BulkRowResult[] = [];
    let created = 0;
    let linked = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const firstName = col(row, 'first name');
      const lastName = col(row, 'last name');
      const rawPhone = col(row, 'phone');
      const name = `${firstName} ${lastName}`.trim();

      try {
        if (!firstName || !lastName || !rawPhone) {
          results.push({
            row: rowNumber,
            name: name || `Row ${rowNumber}`,
            status: 'error',
            error: 'Missing required field(s): First Name, Last Name, Phone',
          });
          continue;
        }

        const rawEmail = col(row, 'email');
        const rawGender = col(row, 'gender');
        const notes = col(row, 'notes', 'note', 'details', 'comments');
        const locationOverride = col(row, 'church location', 'location');
        const location = locationOverride || defaultLocation;

        const { contact, isNew } = await this.resolveContact(
          tenantId,
          userId,
          firstName,
          lastName,
          rawPhone,
          rawEmail,
          '',
          rawGender,
        );

        const taskTitle = `Red Zone Follow up — ${firstName} ${lastName} - ${rawPhone}`;
        const taskComment = buildComment(
          notes ? `Notes: ${notes}` : undefined,
          location ? `Location: ${location}` : undefined,
        );

        const task = await this.createFollowUpTask(
          tenantId,
          userId,
          contact.id,
          taskTitle,
          taskComment,
        );

        const summaryParts: string[] = ['Recorded in Red Zone'];
        if (location) summaryParts.push(`at ${location}`);
        if (reason) summaryParts.push(`(${reason})`);

        await this.contactActivityService.record({
          tenantId,
          contactId: contact.id,
          type: ContactActivityType.TASK_CREATED,
          summary: summaryParts.join(' '),
          occurredAt: new Date(),
          recordedById: userId,
          referenceTable: 'task',
          referenceId: task.id,
        });

        if (isNew) created++;
        else linked++;

        results.push({
          row: rowNumber,
          name,
          status: isNew ? 'created' : 'linked',
        });
      } catch (err) {
        Logger.error(`Red Zone bulk row ${rowNumber}: ${err.message}`);
        results.push({
          row: rowNumber,
          name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return {
      total: rows.length,
      created,
      linked,
      errors: results.filter((r) => r.status === 'error'),
    };
  }
}
