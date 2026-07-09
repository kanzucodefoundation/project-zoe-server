import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FellowshipAttendanceService } from './fellowship-attendance.service';
import { Connection } from 'typeorm';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { FellowshipSchedule } from '../entities/fellowship-schedule.entity';
import { FellowshipInstance } from '../entities/fellowship-instance.entity';
import { FellowshipAttendance } from '../entities/fellowship-attendance.entity';
import Contact from '../../crm/entities/contact.entity';
import Person from '../../crm/entities/person.entity';
import GroupMembership from '../../groups/entities/groupMembership.entity';
import { GroupRole } from '../../groups/enums/groupRole';
import { GroupCategoryPurpose } from '../../groups/enums/groups';

describe('FellowshipAttendanceService', () => {
  let service: FellowshipAttendanceService;
  let mockScheduleRepo: any;
  let mockInstanceRepo: any;
  let mockAttendanceRepo: any;
  let mockContactRepo: any;
  let mockMembershipRepo: any;
  let mockConnection: any;
  let mockTenantContext: any;

  // Shared chainable query builder mock — tests override getRawMany per case
  let mockQb: any;

  const TENANT_ID = 1;
  const CONTACT_ID = 42;

  beforeEach(async () => {
    mockQb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    mockScheduleRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 99, ...entity })),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
    mockInstanceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 77, ...entity })),
    };
    mockAttendanceRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(),
    };
    mockContactRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
    mockMembershipRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    mockConnection = {
      getRepository: jest.fn((entity) => {
        if (entity === FellowshipSchedule) return mockScheduleRepo;
        if (entity === FellowshipInstance) return mockInstanceRepo;
        if (entity === FellowshipAttendance) return mockAttendanceRepo;
        if (entity === Contact) return mockContactRepo;
        if (entity === Person) return {};
        if (entity === GroupMembership) return mockMembershipRepo;
        return {};
      }),
      transaction: jest.fn((fn) =>
        fn({
          save: jest.fn(),
          find: jest.fn().mockResolvedValue([]),
          remove: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn(),
          increment: jest.fn(),
          create: jest.fn((_, dto) => dto),
        }),
      ),
    };

    mockTenantContext = {
      requireTenant: jest.fn().mockReturnValue(TENANT_ID),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FellowshipAttendanceService,
        { provide: 'CONNECTION', useValue: mockConnection },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<FellowshipAttendanceService>(
      FellowshipAttendanceService,
    );
  });

  describe('getMyMembers', () => {
    it('returns empty array when contact leads no fellowship groups', async () => {
      mockQb.getRawMany.mockResolvedValue([]); // no fellowship group IDs

      const result = await service.getMyMembers(CONTACT_ID);

      expect(result).toEqual([]);
    });

    it('returns empty array when fellowship group has no active members', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([{ groupId: 10 }]) // leads group 10
        .mockResolvedValue([]); // no members
      mockMembershipRepo.find.mockResolvedValue([]); // Step 2: no memberships

      const result = await service.getMyMembers(CONTACT_ID);

      expect(result).toEqual([]);
    });

    it('queries only fellowship groups (purpose = FELLOWSHIP) for the leader', async () => {
      mockQb.getRawMany.mockResolvedValue([]); // short-circuits early

      await service.getMyMembers(CONTACT_ID);

      const qbCalls = mockMembershipRepo.createQueryBuilder.mock.calls;
      expect(qbCalls.length).toBeGreaterThan(0);
      // The andWhere for fellowship purpose must be applied
      const andWhereCalls = mockQb.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls).toContain('c.purpose = :purpose');
    });

    it('resolves member contact details for found members', async () => {
      const memberContactIds = [51, 52];
      mockQb.getRawMany
        .mockResolvedValueOnce([{ groupId: 10 }]) // Step 1: leads group 10
        .mockResolvedValueOnce([
          // Step 3: contact query
          { id: 51, firstName: 'Jane', lastName: 'Doe', avatar: null },
          { id: 52, firstName: 'John', lastName: 'Doe', avatar: null },
        ]);
      mockMembershipRepo.find.mockResolvedValue(
        memberContactIds.map((contactId) => ({ contactId })),
      );

      const result = await service.getMyMembers(CONTACT_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 51,
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(result[1]).toMatchObject({
        id: 52,
        firstName: 'John',
        lastName: 'Doe',
      });
    });
  });

  describe('getMySchedule', () => {
    it('returns { exists: false } when contact leads no fellowship groups', async () => {
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.getMySchedule(CONTACT_ID);

      expect(result).toMatchObject({ exists: false });
      expect(result).toHaveProperty('weekdays');
    });

    it('returns { exists: false } when no active schedule is configured', async () => {
      mockQb.getRawMany.mockResolvedValue([{ groupId: 10 }]);
      mockScheduleRepo.findOne.mockResolvedValue(null);

      const result = await service.getMySchedule(CONTACT_ID);

      expect(result).toMatchObject({ exists: false });
    });

    it('returns schedule details when an active schedule exists', async () => {
      mockQb.getRawMany.mockResolvedValue([{ groupId: 10 }]);
      mockScheduleRepo.findOne.mockResolvedValue({
        id: 5,
        meetingDay: 3, // Wednesday
        startTime: '18:00:00',
        frequency: 'weekly',
        fellowshipGroupId: 10,
      });

      const result = await service.getMySchedule(CONTACT_ID);

      expect(result).toMatchObject({
        exists: true,
        id: 5,
        day: 3,
        label: 'Wednesdays',
        startTime: '18:00:00',
        frequency: 'weekly',
        fellowshipGroupId: 10,
      });
    });

    it('is scoped to direct fellowship leaders — non-leaders get { exists: false }', async () => {
      // A FOB leader is not a fellowship group leader, so getRawMany returns []
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.getMySchedule(99 /* FOB leader contactId */);

      // Must return exists:false, not throw or expose other groups' schedules
      expect(result).toMatchObject({ exists: false });
      expect(mockScheduleRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('recordReportAttendance', () => {
    it('throws when submitter leads no fellowship group', async () => {
      mockQb.getRawMany.mockResolvedValue([]);

      await expect(
        service.recordReportAttendance(CONTACT_ID, 1, 3, [51, 52]),
      ).rejects.toThrow('No fellowship group found for submitting user');
    });

    it('creates a schedule when none exists for the fellowship group', async () => {
      mockQb.getRawMany.mockResolvedValue([{ groupId: 10 }]);
      mockScheduleRepo.findOne.mockResolvedValue(null); // no existing schedule
      mockInstanceRepo.findOne.mockResolvedValue({ id: 77 });

      await service.recordReportAttendance(CONTACT_ID, 1, 3, [51]);

      expect(mockScheduleRepo.save).toHaveBeenCalled();
    });

    it('reuses an existing schedule when one is already configured', async () => {
      const existingSchedule = { id: 5, fellowshipGroupId: 10 };
      mockQb.getRawMany.mockResolvedValue([{ groupId: 10 }]);
      mockScheduleRepo.findOne.mockResolvedValue(existingSchedule);
      mockInstanceRepo.findOne.mockResolvedValue({ id: 77 });

      await service.recordReportAttendance(CONTACT_ID, 1, 3, [51]);

      expect(mockScheduleRepo.save).not.toHaveBeenCalled();
    });

    it('replaces existing member attendance records on re-submission', async () => {
      mockQb.getRawMany.mockResolvedValue([{ groupId: 10 }]);
      mockScheduleRepo.findOne.mockResolvedValue({ id: 5 });
      mockInstanceRepo.findOne.mockResolvedValue({ id: 77 });

      const existingRecord = {
        id: 1,
        fellowshipInstanceId: 77,
        isMember: true,
      };
      const mockManager = {
        save: jest.fn(),
        find: jest.fn().mockResolvedValue([existingRecord]),
        remove: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        increment: jest.fn(),
        create: jest.fn((_, dto) => dto),
      };
      mockConnection.transaction.mockImplementation((fn) => fn(mockManager));

      await service.recordReportAttendance(CONTACT_ID, 1, 3, [51, 52]);

      expect(mockManager.remove).toHaveBeenCalledWith(FellowshipAttendance, [
        existingRecord,
      ]);
      expect(mockManager.save).toHaveBeenCalled();
    });
  });

  describe('createSchedule', () => {
    it('saves a new schedule with the current tenant', async () => {
      const dto = {
        fellowshipGroupId: 10,
        meetingDay: 3,
        startTime: '18:00',
        frequency: 'weekly',
      };
      const saved = { id: 99, ...dto };
      mockScheduleRepo.save.mockResolvedValue(saved);

      const result = await service.createSchedule(dto as any, 1);

      expect(mockTenantContext.requireTenant).toHaveBeenCalled();
      expect(mockScheduleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenant: { id: TENANT_ID } }),
      );
      expect(result).toEqual(saved);
    });
  });

  describe('updateSchedule', () => {
    it('throws NotFoundException when schedule does not exist', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSchedule(999, { meetingDay: 2 } as any, CONTACT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when contact is not the fellowship leader', async () => {
      mockScheduleRepo.findOne.mockResolvedValue({
        id: 5,
        fellowshipGroupId: 10,
      });
      mockQb.getCount.mockResolvedValue(0); // not a leader

      await expect(
        service.updateSchedule(5, { meetingDay: 4 } as any, CONTACT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('saves changes when contact is the fellowship leader', async () => {
      const schedule = { id: 5, fellowshipGroupId: 10, meetingDay: 3 };
      mockScheduleRepo.findOne.mockResolvedValue(schedule);
      mockQb.getCount.mockResolvedValue(1); // is leader
      mockScheduleRepo.save.mockResolvedValue({ ...schedule, meetingDay: 4 });

      const result = await service.updateSchedule(
        5,
        { meetingDay: 4 } as any,
        CONTACT_ID,
      );

      expect(mockScheduleRepo.save).toHaveBeenCalled();
      expect(result.meetingDay).toBe(4);
    });
  });

  describe('getTodayFellowship', () => {
    it('throws NotFoundException when no active schedule exists for the group', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      await expect(service.getTodayFellowship(10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the schedule day does not match today', async () => {
      const today = new Date().getDay();
      const wrongDay = (today + 1) % 7; // tomorrow
      mockScheduleRepo.findOne.mockResolvedValue({
        id: 5,
        meetingDay: wrongDay,
      });

      await expect(service.getTodayFellowship(10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns the fellowship instance when schedule day matches today', async () => {
      const today = new Date().getDay();
      const existingInstance = {
        id: 77,
        scheduleId: 5,
        fellowshipGroupId: 10,
        meetingDate: new Date().toISOString().split('T')[0],
        schedule: { id: 5 },
        fellowshipGroup: { id: 10 },
      };
      mockScheduleRepo.findOne.mockResolvedValue({ id: 5, meetingDay: today });
      mockInstanceRepo.findOne.mockResolvedValue(existingInstance);

      const result = await service.getTodayFellowship(10);

      expect(result).toEqual(existingInstance);
    });
  });
});
