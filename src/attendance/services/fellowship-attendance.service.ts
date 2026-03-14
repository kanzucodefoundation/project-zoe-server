import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import { FellowshipSchedule } from '../entities/fellowship-schedule.entity';
import { FellowshipInstance } from '../entities/fellowship-instance.entity';
import { FellowshipAttendance } from '../entities/fellowship-attendance.entity';
import Contact from '../../crm/entities/contact.entity';
import Person from '../../crm/entities/person.entity';
import GroupMembership from '../../groups/entities/groupMembership.entity';
import { TenantContext } from '../../shared/tenant/tenant-context';
import {
  CreateFellowshipScheduleDto,
  UpdateFellowshipScheduleDto,
} from '../dto/fellowship-schedule.dto';
import {
  FellowshipCheckInDto,
  QuickFellowshipVisitorDto,
} from '../dto/fellowship-check-in.dto';
import { RosterSearchDto } from '../dto/check-in.dto';
import { ContactCategory } from '../../crm/enums/contactCategory';
import { Gender } from '../../crm/enums/gender';

@Injectable()
export class FellowshipAttendanceService {
  private readonly scheduleRepo: Repository<FellowshipSchedule>;
  private readonly instanceRepo: Repository<FellowshipInstance>;
  private readonly attendanceRepo: Repository<FellowshipAttendance>;
  private readonly contactRepo: Repository<Contact>;
  private readonly personRepo: Repository<Person>;
  private readonly membershipRepo: Repository<GroupMembership>;

  constructor(
    @Inject('CONNECTION') private connection: Connection,
    private tenantContext: TenantContext,
  ) {
    this.scheduleRepo = connection.getRepository(FellowshipSchedule);
    this.instanceRepo = connection.getRepository(FellowshipInstance);
    this.attendanceRepo = connection.getRepository(FellowshipAttendance);
    this.contactRepo = connection.getRepository(Contact);
    this.personRepo = connection.getRepository(Person);
    this.membershipRepo = connection.getRepository(GroupMembership);
  }

  async createSchedule(
    dto: CreateFellowshipScheduleDto,
    userId: number,
  ): Promise<FellowshipSchedule> {
    const tenantId = this.tenantContext.requireTenant();
    const schedule = this.scheduleRepo.create({
      ...dto,
      tenant: { id: tenantId } as any,
      fellowshipGroup: { id: dto.fellowshipGroupId } as any,
      createdBy: { id: userId } as any,
    });
    return this.scheduleRepo.save(schedule);
  }

  async updateSchedule(
    id: number,
    dto: UpdateFellowshipScheduleDto,
  ): Promise<FellowshipSchedule> {
    const tenantId = this.tenantContext.requireTenant();
    const schedule = await this.scheduleRepo.findOne({
      where: { id, tenant: { id: tenantId } as any },
    });
    if (!schedule) {
      throw new NotFoundException(`Fellowship schedule ${id} not found`);
    }
    Object.assign(schedule, dto);
    return this.scheduleRepo.save(schedule);
  }

  async getSchedules(fellowshipGroupId?: number): Promise<FellowshipSchedule[]> {
    const tenantId = this.tenantContext.requireTenant();
    const query = this.scheduleRepo
      .createQueryBuilder('fs')
      .leftJoinAndSelect('fs.fellowshipGroup', 'group')
      .where('fs.tenantId = :tenantId', { tenantId })
      .andWhere('fs.isActive = true');

    if (fellowshipGroupId) {
      query.andWhere('fs.fellowshipGroupId = :fellowshipGroupId', {
        fellowshipGroupId,
      });
    }
    return query
      .orderBy('fs.meetingDay', 'ASC')
      .addOrderBy('fs.startTime', 'ASC')
      .getMany();
  }

  async getTodayFellowship(fellowshipGroupId: number): Promise<FellowshipInstance> {
    const tenantId = this.tenantContext.requireTenant();
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    const schedule = await this.scheduleRepo.findOne({
      where: {
        tenant: { id: tenantId } as any,
        fellowshipGroupId,
        isActive: true,
      },
    });
    if (!schedule) {
      throw new NotFoundException('No active fellowship schedule found');
    }
    if (schedule.meetingDay !== dayOfWeek) {
      throw new BadRequestException(
        'No fellowship meeting scheduled for today',
      );
    }

    let instance = await this.instanceRepo.findOne({
      where: {
        tenant: { id: tenantId } as any,
        scheduleId: schedule.id,
        meetingDate: today,
      },
      relations: ['schedule', 'fellowshipGroup'],
    });

    if (!instance) {
      instance = await this.instanceRepo.save(
        this.instanceRepo.create({
          tenant: { id: tenantId } as any,
          schedule: { id: schedule.id } as any,
          scheduleId: schedule.id,
          fellowshipGroup: { id: fellowshipGroupId } as any,
          fellowshipGroupId,
          meetingDate: today,
          status: 'active',
        }),
      );
      instance = await this.instanceRepo.findOne({
        where: { id: instance.id },
        relations: ['schedule', 'fellowshipGroup'],
      });
    }

    return instance;
  }

  async getRoster(fellowshipInstanceId: number, searchDto?: RosterSearchDto) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: fellowshipInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Fellowship instance not found');
    }

    const memberIds = await this.membershipRepo
      .createQueryBuilder('gm')
      .select('gm.contactId')
      .where('gm.groupId = :groupId', { groupId: instance.fellowshipGroupId })
      .andWhere('gm.isActive = true')
      .getRawMany()
      .then((rows) => rows.map((r) => r.gm_contact_id));

    let query = this.contactRepo
      .createQueryBuilder('c')
      .innerJoin('c.person', 'p')
      .leftJoin(
        FellowshipAttendance,
        'fa',
        'fa.fellowshipInstanceId = :instanceId AND fa.contactId = c.id',
        { instanceId: fellowshipInstanceId },
      )
      .select([
        'c.id AS id',
        'p.firstName AS "firstName"',
        'p.lastName AS "lastName"',
        'p.avatar AS avatar',
        'fa.checkedInAt AS "checkedInAt"',
        'CASE WHEN fa.id IS NOT NULL THEN true ELSE false END AS "isCheckedIn"',
        `CASE WHEN c.id = ANY(:memberIds) THEN true ELSE false END AS "isMember"`,
      ])
      .setParameter('memberIds', memberIds.length > 0 ? memberIds : [0])
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.category = :category', {
        category: ContactCategory.Person,
      });

    if (searchDto?.search) {
      query = query.andWhere(
        "(p.firstName ILIKE :search OR p.lastName ILIKE :search)",
        { search: `%${searchDto.search}%` },
      );
    }

    return query
      .orderBy('p.firstName', 'ASC')
      .limit(searchDto?.limit || 100)
      .getRawMany();
  }

  async checkIn(
    fellowshipInstanceId: number,
    dto: FellowshipCheckInDto,
    userId: number,
  ) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: fellowshipInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Fellowship instance not found');
    }

    const records = dto.contactIds.map((contactId) =>
      this.attendanceRepo.create({
        tenant: { id: tenantId } as any,
        fellowshipInstance: { id: fellowshipInstanceId } as any,
        fellowshipInstanceId,
        contact: { id: contactId } as any,
        contactId,
        checkedInBy: { id: userId } as any,
        isMember: dto.isMember ?? true,
        notes: dto.notes,
      }),
    );

    await this.connection.transaction(async (manager) => {
      await manager.save(FellowshipAttendance, records);

      const memberCount = records.filter((r) => r.isMember).length;
      const visitorCount = records.filter((r) => !r.isMember).length;

      if (memberCount > 0) {
        await manager.increment(
          FellowshipInstance,
          { id: fellowshipInstanceId },
          'cachedMemberCount',
          memberCount,
        );
      }
      if (visitorCount > 0) {
        await manager.increment(
          FellowshipInstance,
          { id: fellowshipInstanceId },
          'cachedVisitorCount',
          visitorCount,
        );
      }
      await manager.increment(
        FellowshipInstance,
        { id: fellowshipInstanceId },
        'cachedTotalCount',
        records.length,
      );
    });

    return this.instanceRepo.findOne({ where: { id: fellowshipInstanceId } });
  }

  async quickVisitor(
    fellowshipInstanceId: number,
    dto: QuickFellowshipVisitorDto,
    userId: number,
  ) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: fellowshipInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Fellowship instance not found');
    }

    let savedContact: Contact;

    await this.connection.transaction(async (manager) => {
      const contact = manager.create(Contact, {
        tenant: { id: tenantId } as any,
        category: ContactCategory.Person,
      });
      savedContact = await manager.save(Contact, contact);

      const person = manager.create(Person, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: Gender.Male,
        contact: { id: savedContact.id } as any,
        contactId: savedContact.id,
      });
      await manager.save(Person, person);

      const attendance = manager.create(FellowshipAttendance, {
        tenant: { id: tenantId } as any,
        fellowshipInstance: { id: fellowshipInstanceId } as any,
        fellowshipInstanceId,
        contact: { id: savedContact.id } as any,
        contactId: savedContact.id,
        checkedInBy: { id: userId } as any,
        isMember: dto.isMember ?? false,
      });
      await manager.save(FellowshipAttendance, attendance);

      if (dto.isMember) {
        await manager.increment(
          FellowshipInstance,
          { id: fellowshipInstanceId },
          'cachedMemberCount',
          1,
        );
      } else {
        await manager.increment(
          FellowshipInstance,
          { id: fellowshipInstanceId },
          'cachedVisitorCount',
          1,
        );
      }
      await manager.increment(
        FellowshipInstance,
        { id: fellowshipInstanceId },
        'cachedTotalCount',
        1,
      );
    });

    return savedContact;
  }
}
