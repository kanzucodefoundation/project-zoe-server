import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/services/groups.service';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import { GroupTreeService } from '../groups/services/group-tree.service';
import { AppLogger } from '../utils/app-logger.service';
import { TenantContext } from '../shared/tenant/tenant-context';
import { FellowshipAttendanceService } from '../attendance/services/fellowship-attendance.service';
import { Connection, In, Repository, TreeRepository } from 'typeorm';
import Contact from '../crm/entities/contact.entity';
import { Report } from './entities/report.entity';
import { ReportStatus } from './enums/report.enum';
import { ReportSubmission } from './entities/report.submission.entity';
import { ReportSubmissionData } from './entities/report.submission.data.entity';
import { User } from '../users/entities/user.entity';
import { ReportField } from './entities/report.field.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';
import { GroupRole } from '../groups/enums/groupRole';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue('mock-message-id'),
}));

describe('ReportsService', () => {
  let service: ReportsService;
  let mockConnection: Partial<Connection>;
  let mockUsersService: Partial<UsersService>;
  let mockGroupsService: Partial<GroupsService>;
  let mockGroupPermissionsService: Partial<GroupPermissionsService>;
  let mockGroupTreeService: Partial<GroupTreeService>;
  let mockAppLogger: Partial<AppLogger>;
  let mockTenantContext: Partial<TenantContext>;
  let mockFellowshipAttendanceService: Partial<FellowshipAttendanceService>;
  let mockNotificationsService: Partial<NotificationsService>;
  let mockRepositories: any;

  beforeEach(async () => {
    // Create mock repositories
    mockRepositories = {
      report: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      reportSubmission: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      reportSubmissionData: {
        find: jest.fn(),
        save: jest.fn(),
      },
      user: {
        findOne: jest.fn(),
      },
      reportField: {
        save: jest.fn(),
        find: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      groupMembership: {
        find: jest.fn(),
        findOne: jest.fn(),
      },
      groupTree: {
        findDescendants: jest.fn(),
        findAncestors: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
      },
      contact: {
        createQueryBuilder: jest.fn(),
      },
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Report) return mockRepositories.report;
        if (entity === ReportSubmission)
          return mockRepositories.reportSubmission;
        if (entity === ReportSubmissionData)
          return mockRepositories.reportSubmissionData;
        if (entity === User) return mockRepositories.user;
        if (entity === ReportField) return mockRepositories.reportField;
        if (entity === GroupMembership) return mockRepositories.groupMembership;
        if (entity === Contact) return mockRepositories.contact;
        return mockRepositories.report;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockRepositories.groupTree),
      transaction: jest.fn(async (work: any) => {
        const manager = {
          save: jest.fn((entity: any, entityOrEntities: any) => {
            if (entity === ReportSubmission) {
              return mockRepositories.reportSubmission.save(entityOrEntities);
            }
            if (entity === ReportSubmissionData) {
              return mockRepositories.reportSubmissionData.save(
                entityOrEntities,
              );
            }
            throw new Error(`Unexpected entity passed to manager.save`);
          }),
        };
        return work(manager);
      }),
    };

    // Create mock services
    mockUsersService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockGroupsService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockGroupTreeService = {
      getGroupAndAllChildren: jest.fn(),
      getCategoriesForGroups: jest.fn(),
      getGroupsByCategories: jest.fn(),
      getReportAccessibleGroups: jest.fn(),
    };

    mockGroupPermissionsService = {
      hasPermissionForGroup: jest.fn(),
      assertPermissionForGroup: jest.fn(),
      getUserGroupIds: jest.fn(),
      getUserIsMemberLeaderGroupIds: jest.fn(),
    };

    mockTenantContext = {
      tenantId: 1,
      hasTenant: jest.fn().mockReturnValue(true),
      requireTenant: jest.fn().mockReturnValue(1),
    };

    mockFellowshipAttendanceService = {
      recordReportAttendance: jest.fn(),
      getMyMembers: jest.fn(),
    };
    mockNotificationsService = {
      create: jest.fn().mockResolvedValue({}),
      findAllForUser: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getUnreadCount: jest.fn().mockResolvedValue(0),
      markAsRead: jest.fn().mockResolvedValue({}),
      markAllAsRead: jest.fn().mockResolvedValue({ updated: 0 }),
    };

    mockAppLogger = {
      createContextLogger: jest.fn().mockReturnValue({
        startTracking: jest.fn().mockReturnValue('tracking-id'),
        endTracking: jest.fn(),
        apiLog: jest.fn(),
        business: jest.fn(),
        dataAccess: jest.fn(),
        security: jest.fn(),
        error: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: GroupsService,
          useValue: mockGroupsService,
        },
        {
          provide: GroupPermissionsService,
          useValue: mockGroupPermissionsService,
        },
        {
          provide: GroupTreeService,
          useValue: mockGroupTreeService,
        },
        {
          provide: AppLogger,
          useValue: mockAppLogger,
        },
        {
          provide: TenantContext,
          useValue: mockTenantContext,
        },
        {
          provide: FellowshipAttendanceService,
          useValue: mockFellowshipAttendanceService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create context logger on initialization', () => {
    expect(mockAppLogger.createContextLogger).toHaveBeenCalledWith(
      'ReportsService',
    );
  });

  it('should initialize all repositories correctly', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Report);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(ReportField);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(
      ReportSubmissionData,
    );
    expect(mockConnection.getRepository).toHaveBeenCalledWith(ReportSubmission);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(User);
    expect(mockConnection.getTreeRepository).toHaveBeenCalledWith(Group);
  });

  describe('getReport', () => {
    it('returns the report when it exists and is active', async () => {
      const mockReport = {
        id: 1,
        name: 'Weekly Report',
        status: ReportStatus.ACTIVE,
        fields: [],
      } as unknown as Report;
      mockRepositories.report.findOne.mockResolvedValue(mockReport);

      const result = await service.getReport(1);

      expect(result).toEqual(mockReport);
      expect(mockRepositories.report.findOne).toHaveBeenCalledWith({
        where: { id: 1, status: ReportStatus.ACTIVE },
        relations: ['fields', 'targetGroupCategory'],
      });
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockRepositories.report.findOne.mockResolvedValue(null);

      await expect(service.getReport(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllReports', () => {
    it('returns all active reports without filtering when no user is provided', async () => {
      const mockReports = [
        { id: 1, name: 'Report A', status: ReportStatus.ACTIVE },
        { id: 2, name: 'Report B', status: ReportStatus.ACTIVE },
      ] as unknown as Report[];
      mockRepositories.report.find.mockResolvedValue(mockReports);

      const result = await service.getAllReports();

      expect(result.reports).toHaveLength(2);
      expect(mockRepositories.report.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ReportStatus.ACTIVE },
        }),
      );
    });

    it('returns empty array when no active reports exist', async () => {
      mockRepositories.report.find.mockResolvedValue([]);

      const result = await service.getAllReports();

      expect(result.reports).toEqual([]);
    });
  });

  describe('updateReport', () => {
    it('throws NotFoundException when report to update does not exist', async () => {
      mockRepositories.report.update = jest.fn().mockResolvedValue(undefined);
      mockRepositories.report.findOne.mockResolvedValue(null);

      // No fields so updateReportFields is skipped and the NotFoundException path is reached
      await expect(
        service.updateReport(999, { name: 'New Name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the updated report when update succeeds', async () => {
      const updatedReport = {
        id: 1,
        name: 'New Name',
        fields: [],
      } as unknown as Report;
      mockRepositories.report.update = jest.fn().mockResolvedValue(undefined);
      mockRepositories.reportField.find.mockResolvedValue([]);
      mockRepositories.report.findOne.mockResolvedValue(updatedReport);

      const result = await service.updateReport(1, {
        name: 'New Name',
        fields: [],
      } as any);

      expect(result).toEqual(updatedReport);
    });
  });

  describe('getWeekNumber', () => {
    it('returns week 1 for the first day of a month', () => {
      expect(service.getWeekNumber(new Date('2024-01-01'))).toBe(1);
    });

    it('returns a higher week number for later dates', () => {
      const week1 = service.getWeekNumber(new Date('2024-01-01'));
      const week2 = service.getWeekNumber(new Date('2024-01-08'));
      expect(week2).toBeGreaterThan(week1);
    });
  });

  describe('getMySubmissions', () => {
    const mockUser = { id: 7, contactId: 3 };

    const makeSubmission = (id: number) => ({
      id,
      report: { id: 1, name: 'Weekly Report' },
      group: { id: 10, name: 'MC Nairobi' },
      user: { id: 7, username: 'shepherd' },
      submittedAt: new Date('2024-06-10'),
      submissionData: [
        { reportField: { name: 'attendance' }, fieldValue: '25' },
      ],
    });

    it('returns paginated submissions for the current user', async () => {
      const subs = [makeSubmission(1), makeSubmission(2)];
      mockRepositories.reportSubmission.find.mockResolvedValue(subs);
      mockRepositories.reportSubmission.count = jest.fn().mockResolvedValue(2);

      const result = await service.getMySubmissions(mockUser, {
        limit: 20,
        offset: 0,
      });

      expect(result.submissions).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
      expect(mockRepositories.reportSubmission.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: mockUser.id } } }),
      );
    });

    it('filters by reportId when provided', async () => {
      mockRepositories.reportSubmission.find.mockResolvedValue([]);
      mockRepositories.reportSubmission.count = jest.fn().mockResolvedValue(0);

      await service.getMySubmissions(mockUser, { reportId: 5 });

      expect(mockRepositories.reportSubmission.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { id: mockUser.id }, report: { id: 5 } },
        }),
      );
    });

    it('sets hasMore correctly when more pages exist', async () => {
      mockRepositories.reportSubmission.find.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => makeSubmission(i + 1)),
      );
      mockRepositories.reportSubmission.count = jest.fn().mockResolvedValue(50);

      const result = await service.getMySubmissions(mockUser, {
        limit: 20,
        offset: 0,
      });

      expect(result.pagination.hasMore).toBe(true);
    });

    it('maps submission data fields into a keyed object', async () => {
      mockRepositories.reportSubmission.find.mockResolvedValue([
        makeSubmission(1),
      ]);
      mockRepositories.reportSubmission.count = jest.fn().mockResolvedValue(1);

      const result = await service.getMySubmissions(mockUser, {});

      expect(result.submissions[0].data).toEqual({ attendance: '25' });
    });
  });

  describe('getMyGroupsSubmissions', () => {
    const mockUser = { id: 7, contactId: 3 };

    const makeSubmission = (id: number, groupId = 10) => ({
      id,
      report: { id: 1, name: 'Weekly Report' },
      group: { id: groupId, name: 'MC Nairobi' },
      user: { id: 7, username: 'shepherd' },
      submittedAt: new Date('2024-06-10'),
      submissionData: [
        { reportField: { name: 'attendance' }, fieldValue: '30' },
      ],
    });

    it('returns empty result when user has no accessible groups', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([]);

      const result = await service.getMyGroupsSubmissions(mockUser, {});

      expect(result.submissions).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('returns submissions for all groups accessible to the user', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10, 11]);
      mockRepositories.reportSubmission.find.mockResolvedValue([
        makeSubmission(1, 10),
        makeSubmission(2, 11),
      ]);

      const result = await service.getMyGroupsSubmissions(mockUser, {});

      expect(result.submissions).toHaveLength(2);
    });

    it('applies date filtering when startDate/endDate are provided', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);

      const before = new Date('2024-06-01');
      const after = new Date('2024-06-20');
      mockRepositories.reportSubmission.find.mockResolvedValue([
        { ...makeSubmission(1), submittedAt: before },
        { ...makeSubmission(2), submittedAt: after },
      ]);

      const result = await service.getMyGroupsSubmissions(mockUser, {
        startDate: new Date('2024-06-10'),
        endDate: new Date('2024-06-15'),
      });

      expect(result.submissions).toHaveLength(0); // both outside the window
    });

    it('applies pagination to the filtered result set', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.reportSubmission.find.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => makeSubmission(i + 1)),
      );

      const result = await service.getMyGroupsSubmissions(mockUser, {
        limit: 2,
        offset: 0,
      });

      expect(result.submissions).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        total: 5,
        limit: 2,
        hasMore: true,
      });
    });

    it('includes column metadata when reportId is specified', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.reportSubmission.find.mockResolvedValue([
        makeSubmission(1),
      ]);
      mockRepositories.report.findOne.mockResolvedValue({
        id: 1,
        fields: [{ name: 'attendance', label: 'Attendance Count' }],
      });

      const result = await service.getMyGroupsSubmissions(mockUser, {
        reportId: 1,
      });

      expect(result.columns).toEqual([
        { name: 'attendance', label: 'Attendance Count' },
      ]);
    });
  });

  describe('submitReport - weekly duplicate limit', () => {
    const mockUser = { id: 7, contactId: 3 } as any;

    const baseReport = {
      id: 1,
      name: 'Weekly Report',
      status: ReportStatus.ACTIVE,
      submissionFrequency: 'weekly',
      groupFieldName: 'groupId',
      targetGroupCategory: undefined,
      fields: [],
    } as unknown as Report;

    const savedUser = { id: 7, contactId: 3, username: 'shepherd@example.com' };

    const makeGroup = (id: number, name: string) => ({ id, name }) as Group;

    beforeEach(() => {
      mockRepositories.report.findOne.mockResolvedValue(baseReport);
      mockRepositories.user.findOne.mockResolvedValue(savedUser);
      mockRepositories.reportField.find.mockResolvedValue([]);
      mockRepositories.reportSubmissionData.save.mockResolvedValue([]);
      mockRepositories.reportSubmission.save.mockImplementation((sub: any) =>
        Promise.resolve({
          id: 99,
          ...sub,
        }),
      );
      // Membership grants permission to submit for the target group.
      mockRepositories.groupMembership.findOne.mockResolvedValue({
        group: { id: 10, category: undefined },
      });
      mockGroupPermissionsService.hasPermissionForGroup = jest
        .fn()
        .mockResolvedValue(true);
    });

    // Mirrors getStartOfWeek/formatDateKey in reports.service.ts rather
    // than reaching into the service instance, since these are pure
    // calendar-math helpers with no dependency on service state.
    const formatDateKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const currentPeriodStart = new Date();
    currentPeriodStart.setHours(0, 0, 0, 0);
    currentPeriodStart.setDate(
      currentPeriodStart.getDate() - currentPeriodStart.getDay(),
    );
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
    const currentPeriod = formatDateKey(currentPeriodStart);
    const previousPeriod = formatDateKey(previousPeriodStart);

    it('blocks a second submission of the same report for the same group in the same week', async () => {
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      // The current week already has a submission on file for group 10.
      mockRepositories.reportSubmission.findOne.mockResolvedValue({
        id: 55,
        report: { id: 1 },
        group: { id: 10 },
        reportingPeriod: currentPeriod,
      });

      await expect(
        service.submitReport(1, { data: { groupId: '10' } }, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            report: { id: 1, tenant: { id: 1 } },
            group: { id: 10 },
            reportingPeriod: currentPeriod,
          }),
        }),
      );
      expect(mockRepositories.reportSubmission.save).not.toHaveBeenCalled();
    });

    it('allows the submission when the current week is not yet covered, even if last week was missed', async () => {
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      // Nothing on file for the current week -- whether or not last week
      // was ever submitted is irrelevant for a report with no configured
      // due day: it should never be silently reassigned to last week.
      mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      const result = await service.submitReport(
        1,
        { data: { groupId: '10' } },
        mockUser,
      );

      expect(result.status).toBe(200);
      expect(mockRepositories.reportSubmission.save).toHaveBeenCalledWith(
        expect.objectContaining({ reportingPeriod: currentPeriod }),
      );
    });

    it('allows submitting the same report again for a different group in the same week', async () => {
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(11, 'MC Kampala'),
      );
      mockRepositories.groupMembership.findOne.mockResolvedValue({
        group: { id: 11, category: undefined },
      });
      // No existing submission for group 11.
      mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      const result = await service.submitReport(
        1,
        { data: { groupId: '11' } },
        mockUser,
      );

      expect(result.status).toBe(200);
      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            report: { id: 1, tenant: { id: 1 } },
            group: { id: 11 },
            reportingPeriod: currentPeriod,
          }),
        }),
      );
      expect(mockRepositories.reportSubmission.save).toHaveBeenCalled();
    });

    it('falls back to per-user limiting when the report has no associated group', async () => {
      const noGroupReport = {
        ...baseReport,
        groupFieldName: undefined,
        targetGroupCategory: undefined,
        fields: [],
      } as unknown as Report;
      mockRepositories.report.findOne.mockResolvedValue(noGroupReport);
      mockRepositories.reportSubmission.findOne.mockResolvedValue({
        id: 77,
        report: { id: 1 },
        user: { id: 7 },
        reportingPeriod: currentPeriod,
      });

      await expect(
        service.submitReport(1, { data: {} }, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            report: { id: 1, tenant: { id: 1 } },
            user: { id: 7 },
            reportingPeriod: currentPeriod,
          }),
        }),
      );
    });

    describe('MC Attendance Report due-day (Wednesday) handling', () => {
      const mcReport = {
        ...baseReport,
        name: 'MC Attendance Report',
      } as unknown as Report;

      afterEach(() => {
        jest.useRealTimers();
      });

      it.each([
        ['Sunday', 0],
        ['Monday', 1],
        ['Tuesday', 2],
      ])(
        'targets the previous week when submitting on %s (catch-up window)',
        async (_label, dayOffset) => {
          const day = new Date(currentPeriodStart);
          day.setDate(day.getDate() + dayOffset);
          jest.useFakeTimers().setSystemTime(day);
          mockRepositories.report.findOne.mockResolvedValue(mcReport);
          mockRepositories.groupTree.findOne.mockResolvedValue(
            makeGroup(10, 'MC Nairobi'),
          );
          mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
          mockRepositories.reportField.find.mockResolvedValue([
            { name: 'groupId' },
          ]);

          const result = await service.submitReport(
            1,
            { data: { groupId: '10' } },
            mockUser,
          );

          expect(result.status).toBe(200);
          expect(
            mockRepositories.reportSubmission.findOne,
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                reportingPeriod: previousPeriod,
              }),
            }),
          );
          expect(mockRepositories.reportSubmission.save).toHaveBeenCalledWith(
            expect.objectContaining({ reportingPeriod: previousPeriod }),
          );
        },
      );

      it('targets the current week when submitting on the Wednesday due day, even if last week was missed', async () => {
        const thisWeekWednesday = new Date(currentPeriodStart);
        thisWeekWednesday.setDate(thisWeekWednesday.getDate() + 3);
        jest.useFakeTimers().setSystemTime(thisWeekWednesday);
        mockRepositories.report.findOne.mockResolvedValue(mcReport);
        mockRepositories.groupTree.findOne.mockResolvedValue(
          makeGroup(10, 'MC Nairobi'),
        );
        // Current week is open; whether last week has a submission must
        // not matter -- an on-time Wednesday submission always targets
        // this week, never gets silently redirected to last week.
        mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
        mockRepositories.reportField.find.mockResolvedValue([
          { name: 'groupId' },
        ]);

        const result = await service.submitReport(
          1,
          { data: { groupId: '10' } },
          mockUser,
        );

        expect(result.status).toBe(200);
        expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ reportingPeriod: currentPeriod }),
          }),
        );
        expect(mockRepositories.reportSubmission.save).toHaveBeenCalledWith(
          expect.objectContaining({ reportingPeriod: currentPeriod }),
        );
      });

      it('rejects outright when the catch-up period is already filled, without falling back to another period', async () => {
        jest.useFakeTimers().setSystemTime(currentPeriodStart); // Sunday
        mockRepositories.report.findOne.mockResolvedValue(mcReport);
        mockRepositories.groupTree.findOne.mockResolvedValue(
          makeGroup(10, 'MC Nairobi'),
        );
        // Last week's (the catch-up target's) slot is already filled.
        mockRepositories.reportSubmission.findOne.mockResolvedValue({
          id: 54,
          report: { id: 1 },
          group: { id: 10 },
          reportingPeriod: previousPeriod,
        });

        await expect(
          service.submitReport(1, { data: { groupId: '10' } }, mockUser),
        ).rejects.toThrow(BadRequestException);

        expect(mockRepositories.reportSubmission.save).not.toHaveBeenCalled();
      });

      it('a Sunday catch-up followed by an on-time Wednesday submission covers two distinct weeks, not one', async () => {
        // End-to-end sequence for the exact frustration this feature fixes:
        // forgetting last Wednesday, catching up on Sunday, then still
        // being able to submit on time this Wednesday.
        mockRepositories.report.findOne.mockResolvedValue(mcReport);
        mockRepositories.groupTree.findOne.mockResolvedValue(
          makeGroup(10, 'MC Nairobi'),
        );
        mockRepositories.reportField.find.mockResolvedValue([
          { name: 'groupId' },
        ]);

        // Step 1: catch-up submission on this week's Sunday. Nothing on
        // file yet for either period.
        jest.useFakeTimers().setSystemTime(currentPeriodStart);
        mockRepositories.reportSubmission.findOne.mockResolvedValueOnce(null);
        const firstResult = await service.submitReport(
          1,
          { data: { groupId: '10' } },
          mockUser,
        );
        expect(firstResult.status).toBe(200);
        expect(mockRepositories.reportSubmission.save).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ reportingPeriod: previousPeriod }),
        );

        // Step 2: on-time submission on this week's Wednesday. The
        // catch-up above only filled previousPeriod, so currentPeriod is
        // still open.
        const thisWeekWednesday = new Date(currentPeriodStart);
        thisWeekWednesday.setDate(thisWeekWednesday.getDate() + 3);
        jest.useFakeTimers().setSystemTime(thisWeekWednesday);
        mockRepositories.reportSubmission.findOne.mockResolvedValueOnce(null);
        const secondResult = await service.submitReport(
          1,
          { data: { groupId: '10' } },
          mockUser,
        );
        expect(secondResult.status).toBe(200);
        expect(mockRepositories.reportSubmission.save).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ reportingPeriod: currentPeriod }),
        );
      });
    });

    it('skips the period check entirely for custom-frequency reports', async () => {
      const customReport = {
        ...baseReport,
        submissionFrequency: 'custom',
      } as unknown as Report;
      mockRepositories.report.findOne.mockResolvedValue(customReport);
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      const result = await service.submitReport(
        1,
        { data: { groupId: '10' } },
        mockUser,
      );

      expect(result.status).toBe(200);
      // No lookup for prior submissions, and reportingPeriod is left unset.
      expect(mockRepositories.reportSubmission.findOne).not.toHaveBeenCalled();
      expect(mockRepositories.reportSubmission.save).toHaveBeenCalledWith(
        expect.objectContaining({ reportingPeriod: undefined }),
      );
    });

    it('targets the current calendar month for a monthly report (no configured due day, no backfill)', async () => {
      const monthlyReport = {
        ...baseReport,
        submissionFrequency: 'monthly',
      } as unknown as Report;
      mockRepositories.report.findOne.mockResolvedValue(monthlyReport);
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthPeriod = formatDateKey(currentMonthStart);

      const result = await service.submitReport(
        1,
        { data: { groupId: '10' } },
        mockUser,
      );

      expect(result.status).toBe(200);
      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportingPeriod: currentMonthPeriod,
          }),
        }),
      );
      expect(mockRepositories.reportSubmission.save).toHaveBeenCalledWith(
        expect.objectContaining({ reportingPeriod: currentMonthPeriod }),
      );
    });
  });
  describe('submitReport - transactional integrity', () => {
    const mockUser = { id: 7, contactId: 3 } as any;
    const savedUser = { id: 7, contactId: 3, username: 'shepherd@example.com' };
    const makeGroup = (id: number, name: string) => ({ id, name }) as Group;

    const baseReport = {
      id: 1,
      name: 'Weekly Report',
      status: ReportStatus.ACTIVE,
      submissionFrequency: 'weekly',
      groupFieldName: 'groupId',
      targetGroupCategory: undefined,
      fields: [],
    } as unknown as Report;

    beforeEach(() => {
      mockRepositories.report.findOne.mockResolvedValue(baseReport);
      mockRepositories.user.findOne.mockResolvedValue(savedUser);
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      mockRepositories.groupMembership.findOne.mockResolvedValue({
        group: { id: 10, category: undefined },
      });
      mockGroupPermissionsService.hasPermissionForGroup = jest
        .fn()
        .mockResolvedValue(true);
      mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
      mockRepositories.reportSubmission.save.mockImplementation((sub: any) =>
        Promise.resolve({ id: 99, ...sub }),
      );
      mockRepositories.reportSubmissionData.save.mockResolvedValue([]);
    });

    it('rejects an unknown field name before any row is saved, so no submission is left occupying the period', async () => {
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      await expect(
        service.submitReport(
          1,
          { data: { groupId: '10', bogusField: 'x' } },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockConnection.transaction).not.toHaveBeenCalled();
      expect(mockRepositories.reportSubmission.save).not.toHaveBeenCalled();
      expect(mockRepositories.reportSubmissionData.save).not.toHaveBeenCalled();
    });

    it('saves the submission row and its field data inside a single transaction', async () => {
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
        { name: 'notes' },
      ]);

      const result = await service.submitReport(
        1,
        { data: { groupId: '10', notes: 'all good' } },
        mockUser,
      );

      expect(result.status).toBe(200);
      expect(mockConnection.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepositories.reportSubmission.save).toHaveBeenCalledTimes(1);
      expect(mockRepositories.reportSubmissionData.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            reportSubmission: expect.objectContaining({ id: 99 }),
            reportField: { name: 'notes' },
            fieldValue: 'all good',
          }),
        ]),
      );
    });

    it('propagates a failure saving field data without swallowing it, so the transaction rolls back the submission row too', async () => {
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);
      mockRepositories.reportSubmissionData.save.mockRejectedValueOnce(
        new Error('data save failed'),
      );

      await expect(
        service.submitReport(1, { data: { groupId: '10' } }, mockUser),
      ).rejects.toThrow('data save failed');

      // The submission row was written to the (mocked) transactional
      // manager, but since the transaction as a whole rejects, TypeORM
      // rolls it back -- it must never be treated as a successful,
      // independently-committed row.
      expect(mockConnection.transaction).toHaveBeenCalledTimes(1);
    });

    it('maps a unique-constraint violation raised inside the transaction to a friendly duplicate-submission error', async () => {
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);
      mockRepositories.reportSubmission.save.mockRejectedValueOnce({
        code: '23505',
      });

      await expect(
        service.submitReport(1, { data: { groupId: '10' } }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes and persists PGA in the same transaction for whmSundayService reports', async () => {
      const sundayServiceReport = {
        ...baseReport,
        functionName: 'whmSundayService',
      } as unknown as Report;
      mockRepositories.report.findOne.mockResolvedValue(sundayServiceReport);
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
        { name: '1Sv' },
        { name: '2Sv' },
        { name: 'YXP' },
        { name: 'kids' },
        { name: 'local' },
        { name: 'hc1' },
        { name: 'hc2' },
        { name: 'hc3' },
        { name: 'pga' },
      ]);

      await service.submitReport(
        1,
        {
          data: {
            groupId: '10',
            '1Sv': 100,
            '2Sv': 50,
            YXP: 10,
            kids: 5,
            local: 2,
            hc1: 1,
            hc2: 1,
            hc3: 1,
          },
        },
        mockUser,
      );

      expect(mockRepositories.reportSubmissionData.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reportField: { name: 'pga' },
          fieldValue: '170',
        }),
      );
    });
  });
  describe('Report Submission Notifications (dispatch)', () => {
    const baseReportWithGroup = {
      id: 1,
      name: 'Weekly Report',
      status: ReportStatus.ACTIVE,
      groupFieldName: 'groupId', // needed so selectedGroupId resolves from data.groupId
      targetGroupCategory: undefined,
      fields: [],
    } as unknown as Report;

    const mockTargetGroup = {
      id: 10,
      name: 'MC Nairobi',
      parentId: undefined,
    } as Group;

    const reportId = 1;
    const submittingUser = { id: 7, contactId: 3 } as any;

    beforeEach(() => {
      (mockNotificationsService.create as jest.Mock).mockClear();

      mockRepositories.report.findOne.mockResolvedValue(baseReportWithGroup);
      mockRepositories.user.findOne.mockResolvedValue({
        id: 7,
        contactId: 3,
        username: 'shepherd@example.com',
      });
      mockRepositories.groupMembership.findOne.mockResolvedValue({
        group: { id: 10, category: undefined },
      });
      mockGroupPermissionsService.hasPermissionForGroup = jest
        .fn()
        .mockResolvedValue(true);
      mockRepositories.groupTree.findOne.mockResolvedValue(mockTargetGroup);
      mockRepositories.reportSubmission.findOne.mockResolvedValue(null);
      mockRepositories.reportSubmission.save.mockImplementation((sub: any) =>
        Promise.resolve({ id: 99, ...sub }),
      );
      mockRepositories.reportField.find.mockResolvedValue([
        { name: 'groupId' },
      ]);

      jest
        .spyOn(service as any, 'resolveReportSubmissionRecipients')
        .mockResolvedValue([10, 11]);
    });

    it('dispatches a notification per resolved recipient and tolerates individual failures', async () => {
      await service.submitReport(
        reportId,
        { data: { groupId: '10' } },
        submittingUser,
      );

      expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 10, type: 'report_submitted' }),
      );
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 11, type: 'report_submitted' }),
      );
    });

    it('still resolves the submission when one notification dispatch fails', async () => {
      (mockNotificationsService.create as jest.Mock).mockImplementation(
        ({ userId }: any) =>
          userId === 10
            ? Promise.reject(new Error('Realtime push failed'))
            : Promise.resolve({}),
      );
      const result = await service.submitReport(
        reportId,
        { data: { groupId: '10' } },
        submittingUser,
      );
      expect(result).toBeDefined();
      expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
    });
  });
  describe('getWeeklyMcaSummary', () => {
    const mockUser = { id: 7, contactId: 3 } as any;
    const makeQueryBuilder = (
      result: any,
      terminator: 'getOne' | 'getMany' = 'getMany',
    ) => {
      const qb: any = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
      };
      qb[terminator].mockResolvedValue(result);
      return qb;
    };

    it('returns reportFound: false when no MCA field exists for the tenant', async () => {
      const fieldQb = makeQueryBuilder(null, 'getOne');
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(fieldQb);

      const result = await service.getWeeklyMcaSummary(mockUser);

      expect(result.reportFound).toBe(false);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
      // The field lookup must be scoped to the current tenant.
      const tenantScoped = [
        ...fieldQb.where.mock.calls,
        ...fieldQb.andWhere.mock.calls,
      ].some(([, params]) => params?.tenantId === mockTenantContext.tenantId);
      expect(tenantScoped).toBe(true);
      // Should short-circuit before ever resolving manageable groups.
      expect(mockRepositories.groupMembership.find).not.toHaveBeenCalled();
    });

    it('scopes the field lookup to the MC Attendance Report by name, not just the field label', async () => {
      const fieldQb = makeQueryBuilder(null, 'getOne');
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(fieldQb);

      await service.getWeeklyMcaSummary(mockUser);

      const reportNameScoped = [
        ...fieldQb.where.mock.calls,
        ...fieldQb.andWhere.mock.calls,
      ].some(
        ([sql, params]) =>
          sql.includes('report.name') &&
          params?.reportName === 'MC Attendance Report',
      );
      expect(reportNameScoped).toBe(true);
    });

    it('returns zero total when the MCA field exists but user manages no groups', async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      const fieldQb = makeQueryBuilder(field, 'getOne');
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(fieldQb);
      mockRepositories.groupMembership.find.mockResolvedValue([]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([]);

      const result = await service.getWeeklyMcaSummary(mockUser);

      expect(result.reportFound).toBe(true);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
      // Should short-circuit before ever querying submissions.
      expect(
        mockRepositories.reportSubmission.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('sums attendance across groups the user manages for the single MCA field', async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(field, 'getOne'),
      );

      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10, 11]);

      const submissions = [
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: '15' }],
        },
        {
          group: { id: 11, name: 'MC Kampala' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: '20' }],
        },
      ];
      const submissionQb = makeQueryBuilder(submissions);
      mockRepositories.reportSubmission.createQueryBuilder.mockReturnValue(
        submissionQb,
      );

      const result = await service.getWeeklyMcaSummary(mockUser);

      expect(result.reportFound).toBe(true);
      expect(result.total).toBe(35);
      expect(result.breakdown).toEqual(
        expect.arrayContaining([
          { groupId: 10, groupName: 'MC Nairobi', total: 15 },
          { groupId: 11, groupName: 'MC Kampala', total: 20 },
        ]),
      );

      // Submission query must be scoped to the single resolved report and
      // the user's manageable groups.
      const andWhereCalls = submissionQb.andWhere.mock.calls;
      expect(
        andWhereCalls.some(
          ([sql, params]) =>
            sql.includes('group.id') &&
            Array.isArray(params?.groupIds) &&
            params.groupIds.includes(10) &&
            params.groupIds.includes(11),
        ),
      ).toBe(true);
      // Must filter by reportingPeriod equal to this week's start, not a
      // submittedAt range -- reportingPeriod is the period submitReport
      // deliberately assigned (including MC's Wednesday catch-up window),
      // so it's the authoritative "which week" answer, not just when the
      // row was physically typed in.
      expect(
        andWhereCalls.some(
          ([sql, params]) =>
            sql.includes('submission.reportingPeriod =') &&
            typeof params?.period === 'string',
        ),
      ).toBe(true);
    });

    it('aggregates multiple submissions for the same group into a single breakdown entry (roll-up scenario)', async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(field, 'getOne'),
      );
      // A zonal-level leader managing several MCs that all report into the same group.
      mockRepositories.groupMembership.find.mockResolvedValue([{ groupId: 1 }]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10, 11, 12]);

      const submissions = [
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: '10' }],
        },
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: '5' }],
        },
      ];
      mockRepositories.reportSubmission.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(submissions),
      );

      const result = await service.getWeeklyMcaSummary(mockUser);

      expect(result.total).toBe(15);
      expect(result.breakdown).toEqual([
        { groupId: 10, groupName: 'MC Nairobi', total: 15 },
      ]);
    });

    it('skips non-numeric field values without throwing or affecting the total', async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(field, 'getOne'),
      );
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      const submissions = [
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: 'N/A' }],
        },
      ];
      mockRepositories.reportSubmission.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(submissions),
      );
      const result = await service.getWeeklyMcaSummary(mockUser);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('rejects values with a numeric prefix followed by trailing text (e.g. "15 attendees")', async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(field, 'getOne'),
      );
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      const submissions = [
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [
            { reportField: { id: 1 }, fieldValue: '15 attendees' },
          ],
        },
      ];
      mockRepositories.reportSubmission.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(submissions),
      );
      const result = await service.getWeeklyMcaSummary(mockUser);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("filters submissions by the current week's reportingPeriod, matching the displayed weekStart", async () => {
      const field = {
        id: 1,
        label: 'How many attended MC?',
        report: { id: 100 },
      };
      mockRepositories.reportField.createQueryBuilder.mockReturnValue(
        makeQueryBuilder(field, 'getOne'),
      );
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);

      const submissionQb = makeQueryBuilder([
        {
          group: { id: 10, name: 'MC Nairobi' },
          submissionData: [{ reportField: { id: 1 }, fieldValue: '12' }],
        },
      ]);
      mockRepositories.reportSubmission.createQueryBuilder.mockReturnValue(
        submissionQb,
      );

      const result = await service.getWeeklyMcaSummary(mockUser);

      expect(result.total).toBe(12);
      const periodCall = submissionQb.andWhere.mock.calls.find(([sql]) =>
        sql.includes('submission.reportingPeriod ='),
      );
      expect(periodCall[1].period).toBe(result.weekStart);
    });
  });
  describe('getMcSubmissionCompliance', () => {
    const mockUser = { id: 7, contactId: 3 } as any;

    const makeContactQueryBuilder = (rows: any[]) => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      return qb;
    };
    const makeReportQueryBuilder = (result: any) => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(result),
      };
      return qb;
    };

    beforeEach(() => {
      mockRepositories.groupTree.find.mockReset();
      mockRepositories.reportSubmission.find.mockReset();
      mockRepositories.groupMembership.find.mockReset();
      mockRepositories.contact.createQueryBuilder.mockReset();
      mockRepositories.report.findOne.mockReset();
      mockRepositories.report.createQueryBuilder.mockReset();
    });

    it('returns no groups when the user manages no groups (visibility scoping)', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([]);

      const result = await service.getMcSubmissionCompliance(mockUser);

      expect(result.groups).toEqual([]);
      // Must short-circuit before ever looking at MC groups or submissions.
      expect(mockRepositories.groupTree.find).not.toHaveBeenCalled();
    });

    it('only queries MC groups within the user-scoped group id list', async () => {
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([]); // no MC groups found

      await service.getMcSubmissionCompliance(mockUser);

      expect(mockRepositories.groupTree.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: expect.objectContaining({
              value: expect.arrayContaining([10]),
            }),
          }),
        }),
      );
    });

    it('returns no groups when the MC Attendance Report does not exist', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder(null),
      );

      const result = await service.getMcSubmissionCompliance(mockUser);

      expect(result.groups).toEqual([]);
    });

    it('excludes MC groups that submitted for every week in range', async () => {
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );

      const from = new Date('2026-07-26'); // Sunday
      const to = new Date('2026-08-01'); // same reporting week
      // reportingPeriod (not submittedAt) is what the service buckets on.
      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          group: { id: 10 },
          submittedAt: new Date('2026-07-28T09:00:00Z'),
          reportingPeriod: '2026-07-26',
        },
      ]);
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10, contactId: 55 },
      ]);
      mockRepositories.contact.createQueryBuilder.mockReturnValue(
        makeContactQueryBuilder([
          { id: 55, firstName: 'Grace', lastName: 'Nakato', middleName: null },
        ]),
      );

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        from,
        to,
      );

      expect(result.groups).toEqual([]);
    });

    it('includes only MC groups with at least one missed week, sorted worst-first', async () => {
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
        { groupId: 11 },
        { groupId: 12 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10, 11, 12]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
        { id: 11, name: 'MC Kampala' },
        { id: 12, name: 'MC Jinja' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );

      // Two-week range: 10 submitted both weeks (compliant, excluded),
      // 11 submitted neither (weeksMissed = 2), 12 submitted one of two
      // weeks (weeksMissed = 1) — used to assert worst-first ordering.
      const from = new Date('2026-07-19');
      const to = new Date('2026-07-26');
      mockRepositories.reportSubmission.find.mockResolvedValue([
        { group: { id: 10 }, reportingPeriod: '2026-07-19' },
        { group: { id: 10 }, reportingPeriod: '2026-07-26' },
        { group: { id: 12 }, reportingPeriod: '2026-07-19' },
      ]);
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 11, contactId: 77 },
        { groupId: 12, contactId: 88 },
      ]);
      mockRepositories.contact.createQueryBuilder.mockReturnValue(
        makeContactQueryBuilder([
          { id: 77, firstName: 'Brian', lastName: 'Okello', middleName: null },
          { id: 88, firstName: 'Joy', lastName: 'Namono', middleName: null },
        ]),
      );

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        from,
        to,
      );

      expect(result.groups).toHaveLength(2);
      expect(result.groups.map((g) => g.groupId)).toEqual([11, 12]);
      expect(result.groups[0]).toMatchObject({
        groupId: 11,
        groupName: 'MC Kampala',
        leaderName: 'Brian Okello',
        weeksMissed: 2,
        weeksInRange: 2,
      });
      expect(result.groups[1]).toMatchObject({
        groupId: 12,
        groupName: 'MC Jinja',
        leaderName: 'Joy Namono',
        weeksMissed: 1,
        weeksInRange: 2,
      });
    });

    it('flags missingCurrentWeek only when the most recent week is among the missed weeks', async () => {
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );

      const from = new Date('2026-07-19');
      const to = new Date('2026-07-26'); // current week starts 2026-07-26
      // Submitted the earlier week, missed the current one.
      mockRepositories.reportSubmission.find.mockResolvedValue([
        { group: { id: 10 }, reportingPeriod: '2026-07-19' },
      ]);
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10, contactId: 55 },
      ]);
      mockRepositories.contact.createQueryBuilder.mockReturnValue(
        makeContactQueryBuilder([
          { id: 55, firstName: 'Grace', lastName: 'Nakato', middleName: null },
        ]),
      );

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        from,
        to,
      );

      expect(result.groups[0].missingCurrentWeek).toBe(true);
      expect(result.groups[0].missedWeeks).toEqual(['2026-07-26']);
    });

    it('falls back to "No leader assigned" when an MC has no active leader', async () => {
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );
      mockRepositories.reportSubmission.find.mockResolvedValue([]);
      // No active leader membership found for group 10.
      mockRepositories.groupMembership.find.mockResolvedValueOnce([]);

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        new Date('2026-07-26'),
        new Date('2026-07-26'),
      );

      expect(result.groups[0].leaderName).toBe('No leader assigned');
      expect(
        mockRepositories.contact.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('trusts the stored reportingPeriod over submittedAt when a submission was physically typed late', async () => {
      // reportingPeriod is the period submitReport deliberately assigned;
      // submittedAt is just when it was typed in and can legitimately fall
      // outside that week (e.g. someone finishing a submission after
      // midnight). The service must bucket on reportingPeriod, not
      // re-derive the week from submittedAt.
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );

      const from = new Date('2026-07-26');
      const to = new Date('2026-08-01');
      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          group: { id: 10 },
          submittedAt: new Date('2026-08-01T23:50:00Z'), // typed the following Saturday
          reportingPeriod: '2026-07-26', // but covers this week
        },
      ]);
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10, contactId: 55 },
      ]);
      mockRepositories.contact.createQueryBuilder.mockReturnValue(
        makeContactQueryBuilder([
          { id: 55, firstName: 'Grace', lastName: 'Nakato', middleName: null },
        ]),
      );

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        from,
        to,
      );

      // Group 10 covered the only week in range, so it's excluded from the
      // "not submitted" result entirely.
      expect(result.groups).toEqual([]);
    });

    it('still flags the current week as missed when a catch-up submission targets the previous week', async () => {
      // A Sunday catch-up for MC Attendance Report is stored against last
      // week's reportingPeriod (submitReport's due-day logic) even though
      // it was typed during the current week. Compliance must not let that
      // submittedAt timestamp make it look like the current week was
      // covered.
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10 },
      ]);
      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);
      mockRepositories.groupTree.find.mockResolvedValue([
        { id: 10, name: 'MC Nairobi' },
      ]);
      mockRepositories.report.createQueryBuilder.mockReturnValue(
        makeReportQueryBuilder({ id: 100 }),
      );

      const from = new Date('2026-07-19');
      const to = new Date('2026-07-26');
      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          group: { id: 10 },
          submittedAt: new Date('2026-07-26T08:00:00Z'), // typed on the current week's Sunday
          reportingPeriod: '2026-07-19', // recorded as catch-up for last week
        },
      ]);
      mockRepositories.groupMembership.find.mockResolvedValueOnce([
        { groupId: 10, contactId: 55 },
      ]);
      mockRepositories.contact.createQueryBuilder.mockReturnValue(
        makeContactQueryBuilder([
          { id: 55, firstName: 'Grace', lastName: 'Nakato', middleName: null },
        ]),
      );

      const result = await service.getMcSubmissionCompliance(
        mockUser,
        from,
        to,
      );

      expect(result.groups[0].missedWeeks).toEqual(['2026-07-26']);
      expect(result.groups[0].missingCurrentWeek).toBe(true);
    });
  });
});
