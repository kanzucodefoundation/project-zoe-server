import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import { ServiceSchedule } from '../entities/service-schedule.entity';
import { ServiceInstance } from '../entities/service-instance.entity';
import { ServiceAttendance } from '../entities/service-attendance.entity';
import Contact from '../../crm/entities/contact.entity';
import Person from '../../crm/entities/person.entity';
import GroupMembership from '../../groups/entities/groupMembership.entity';
import { TenantContext } from '../../shared/tenant/tenant-context';
import {
  CreateServiceScheduleDto,
  UpdateServiceScheduleDto,
} from '../dto/service-schedule.dto';
import {
  CheckInDto,
  QuickGuestDto,
  RosterSearchDto,
} from '../dto/check-in.dto';
import { ContactCategory } from '../../crm/enums/contactCategory';
import { Gender } from '../../crm/enums/gender';

@Injectable()
export class ServiceAttendanceService {
  private readonly scheduleRepo: Repository<ServiceSchedule>;
  private readonly instanceRepo: Repository<ServiceInstance>;
  private readonly attendanceRepo: Repository<ServiceAttendance>;
  private readonly contactRepo: Repository<Contact>;
  private readonly personRepo: Repository<Person>;

  constructor(
    @Inject('CONNECTION') private connection: Connection,
    private tenantContext: TenantContext,
  ) {
    this.scheduleRepo = connection.getRepository(ServiceSchedule);
    this.instanceRepo = connection.getRepository(ServiceInstance);
    this.attendanceRepo = connection.getRepository(ServiceAttendance);
    this.contactRepo = connection.getRepository(Contact);
    this.personRepo = connection.getRepository(Person);
  }

  async createSchedule(
    dto: CreateServiceScheduleDto,
    userId: number,
  ): Promise<ServiceSchedule> {
    const tenantId = this.tenantContext.requireTenant();
    const schedule = this.scheduleRepo.create({
      ...dto,
      tenant: { id: tenantId } as any,
      location: { id: dto.locationGroupId } as any,
      createdBy: { id: userId } as any,
    });
    return this.scheduleRepo.save(schedule);
  }

  async updateSchedule(
    id: number,
    dto: UpdateServiceScheduleDto,
    userId: number,
  ): Promise<ServiceSchedule> {
    const tenantId = this.tenantContext.requireTenant();
    const schedule = await this.scheduleRepo.findOne({
      where: { id, tenant: { id: tenantId } as any },
    });
    if (!schedule) {
      throw new NotFoundException(`Service schedule ${id} not found`);
    }
    if (dto.locationGroupId) {
      (schedule as any).location = { id: dto.locationGroupId };
    }
    Object.assign(schedule, dto);
    return this.scheduleRepo.save(schedule);
  }

  async getSchedules(
    locationId?: number,
    tags?: string[],
  ): Promise<ServiceSchedule[]> {
    const tenantId = this.tenantContext.requireTenant();
    const query = this.scheduleRepo
      .createQueryBuilder('ss')
      .leftJoinAndSelect('ss.location', 'location')
      .where('ss.tenantId = :tenantId', { tenantId })
      .andWhere('ss.isActive = true');

    if (locationId) {
      query.andWhere('ss.locationGroupId = :locationId', { locationId });
    }
    if (tags && tags.length > 0) {
      query.andWhere('ss.tags @> :tags', { tags });
    }
    return query.orderBy('ss.startTime', 'ASC').getMany();
  }

  async getTodayService(locationId: number): Promise<ServiceInstance> {
    const tenantId = this.tenantContext.requireTenant();
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    const schedule = await this.scheduleRepo
      .createQueryBuilder('ss')
      .where('ss.tenantId = :tenantId', { tenantId })
      .andWhere('ss.locationGroupId = :locationId', { locationId })
      .andWhere('ss.isActive = true')
      .andWhere(':dayOfWeek = ANY(ss.daysOfWeek)', { dayOfWeek })
      .getOne();

    if (!schedule) {
      throw new BadRequestException(
        'No service scheduled for today at this location',
      );
    }

    let instance = await this.instanceRepo.findOne({
      where: {
        tenant: { id: tenantId } as any,
        scheduleId: schedule.id,
        serviceDate: today,
      },
      relations: ['schedule', 'schedule.location'],
    });

    if (!instance) {
      instance = await this.instanceRepo.save(
        this.instanceRepo.create({
          tenant: { id: tenantId } as any,
          schedule: { id: schedule.id } as any,
          scheduleId: schedule.id,
          serviceDate: today,
          status: 'active',
        }),
      );
      instance = await this.instanceRepo.findOne({
        where: { id: instance.id },
        relations: ['schedule', 'schedule.location'],
      });
    }

    return instance;
  }

  async getRoster(serviceInstanceId: number, searchDto?: RosterSearchDto) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: serviceInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Service instance not found');
    }

    let query = this.contactRepo
      .createQueryBuilder('c')
      .innerJoin('c.person', 'p')
      .leftJoin(
        ServiceAttendance,
        'sa',
        'sa.serviceInstanceId = :instanceId AND sa.contactId = c.id',
        { instanceId: serviceInstanceId },
      )
      .select([
        'c.id AS id',
        'p.firstName AS "firstName"',
        'p.lastName AS "lastName"',
        'p.avatar AS avatar',
        'sa.checkedInAt AS "checkedInAt"',
        'CASE WHEN sa.id IS NOT NULL THEN true ELSE false END AS "isCheckedIn"',
      ])
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.category = :category', {
        category: ContactCategory.Person,
      });

    query = query.innerJoin(
      GroupMembership,
      'gm',
      'gm.contactId = c.id AND gm.groupId = :locationId AND gm.isActive = true',
      { locationId: searchDto.locationId },
    );

    if (searchDto?.search) {
      query = query.andWhere(
        '(p.firstName ILIKE :search OR p.lastName ILIKE :search)',
        { search: `%${searchDto.search}%` },
      );
    }

    return query
      .orderBy('p.firstName', 'ASC')
      .limit(searchDto?.limit || 100)
      .getRawMany();
  }

  async checkIn(serviceInstanceId: number, dto: CheckInDto, userId: number) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: serviceInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Service instance not found');
    }

    const records = dto.contactIds.map((contactId) =>
      this.attendanceRepo.create({
        tenant: { id: tenantId } as any,
        serviceInstance: { id: serviceInstanceId } as any,
        serviceInstanceId,
        contact: { id: contactId } as any,
        contactId,
        checkedInBy: { id: userId } as any,
        isChild: dto.isChild ?? false,
        isFirstTime: dto.isFirstTime ?? false,
        notes: dto.notes,
      }),
    );

    await this.connection.transaction(async (manager) => {
      await manager.save(ServiceAttendance, records);
      await manager.increment(
        ServiceInstance,
        { id: serviceInstanceId },
        'cachedTotalCount',
        records.length,
      );
    });

    return this.instanceRepo.findOne({ where: { id: serviceInstanceId } });
  }

  async quickGuest(
    serviceInstanceId: number,
    dto: QuickGuestDto,
    userId: number,
  ) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: serviceInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Service instance not found');
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

      const attendance = manager.create(ServiceAttendance, {
        tenant: { id: tenantId } as any,
        serviceInstance: { id: serviceInstanceId } as any,
        serviceInstanceId,
        contact: { id: savedContact.id } as any,
        contactId: savedContact.id,
        checkedInBy: { id: userId } as any,
        isChild: dto.isChild ?? false,
        isFirstTime: dto.isFirstTime ?? true,
      });
      await manager.save(ServiceAttendance, attendance);

      await manager.increment(
        ServiceInstance,
        { id: serviceInstanceId },
        'cachedTotalCount',
        1,
      );
    });

    return savedContact;
  }

  async getInstances(
    scheduleId?: number,
    locationId?: number,
  ): Promise<ServiceInstance[]> {
    const tenantId = this.tenantContext.requireTenant();
    const query = this.instanceRepo
      .createQueryBuilder('si')
      .leftJoinAndSelect('si.schedule', 'schedule')
      .leftJoinAndSelect('schedule.location', 'location')
      .where('si.tenantId = :tenantId', { tenantId });

    if (scheduleId) {
      query.andWhere('si.scheduleId = :scheduleId', { scheduleId });
    }
    if (locationId) {
      query.andWhere('schedule.locationGroupId = :locationId', { locationId });
    }

    return query.orderBy('si.serviceDate', 'DESC').limit(60).getMany();
  }

  async getAttendees(serviceInstanceId: number) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: serviceInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Service instance not found');
    }

    return this.attendanceRepo
      .createQueryBuilder('sa')
      .innerJoin('sa.contact', 'c')
      .innerJoin('c.person', 'p')
      .select([
        'sa.id AS id',
        'sa.contactId AS "contactId"',
        'p.firstName AS "firstName"',
        'p.lastName AS "lastName"',
        'sa.checkedInAt AS "checkedInAt"',
        'sa.isFirstTime AS "isFirstTime"',
        'sa.isChild AS "isChild"',
        'sa.notes AS notes',
      ])
      .where('sa.serviceInstanceId = :serviceInstanceId', { serviceInstanceId })
      .andWhere('c.tenantId = :tenantId', { tenantId })
      .orderBy('p.firstName', 'ASC')
      .getRawMany();
  }

  async getStats(serviceInstanceId: number) {
    const tenantId = this.tenantContext.requireTenant();
    const instance = await this.instanceRepo.findOne({
      where: { id: serviceInstanceId, tenant: { id: tenantId } as any },
    });
    if (!instance) {
      throw new NotFoundException('Service instance not found');
    }

    const [firstTimeCount, childCount] = await Promise.all([
      this.attendanceRepo.count({
        where: { serviceInstanceId, isFirstTime: true },
      }),
      this.attendanceRepo.count({
        where: { serviceInstanceId, isChild: true },
      }),
    ]);

    return {
      totalCheckedIn: instance.cachedTotalCount,
      firstTimeGuests: firstTimeCount,
      children: childCount,
      adults: instance.cachedTotalCount - childCount,
    };
  }
}
