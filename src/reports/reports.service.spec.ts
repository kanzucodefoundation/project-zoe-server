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
import { Connection, Repository, TreeRepository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportStatus } from './enums/report.enum';
import { ReportSubmission } from './entities/report.submission.entity';
import { ReportSubmissionData } from './entities/report.submission.data.entity';
import { User } from '../users/entities/user.entity';
import { ReportField } from './entities/report.field.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';

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
      },
      reportSubmission: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
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
      },
      groupMembership: {
        find: jest.fn(),
        findOne: jest.fn(),
      },
      groupTree: {
        findDescendants: jest.fn(),
        findAncestors: jest.fn(),
        findOne: jest.fn(),
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
        return mockRepositories.report;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockRepositories.groupTree),
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

    it('calculates weekly attendance total from attendance submissions', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);

      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);

      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          ...makeSubmission(1),
          submissionData: [
            {
              reportField: { name: 'smallGroupAttendanceCount' },
              fieldValue: '10',
            },
          ],
        },
        {
          ...makeSubmission(2),
          submissionData: [
            {
              reportField: { name: 'smallGroupAttendanceCount' },
              fieldValue: '15',
            },
          ],
        },
      ]);

      const result = await service.getMyGroupsSubmissions(mockUser, {});

      expect(result.summary.weeklyAttendanceTotal).toBe(25);
    });

    it('ignores submissions without attendance field', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);

      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);

      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          ...makeSubmission(1),
          submissionData: [
            {
              reportField: { name: 'otherField' },
              fieldValue: '10',
            },
          ],
        },
        {
          ...makeSubmission(2),
          submissionData: [
            {
              reportField: { name: 'smallGroupAttendanceCount' },
              fieldValue: '15',
            },
          ],
        },
      ]);

      const result = await service.getMyGroupsSubmissions(mockUser, {});

      expect(result.summary.weeklyAttendanceTotal).toBe(15);
    });

    it('ignores invalid attendance values', async () => {
      mockRepositories.groupMembership.find.mockResolvedValue([
        { groupId: 10 },
      ]);

      mockGroupTreeService.getGroupAndAllChildren = jest
        .fn()
        .mockResolvedValue([10]);

      mockRepositories.reportSubmission.find.mockResolvedValue([
        {
          ...makeSubmission(1),
          submissionData: [
            {
              reportField: { name: 'smallGroupAttendanceCount' },
              fieldValue: 'abc', // invalid number
            },
          ],
        },
        {
          ...makeSubmission(2),
          submissionData: [
            {
              reportField: { name: 'smallGroupAttendanceCount' },
              fieldValue: '15',
            },
          ],
        },
      ]);

      const result = await service.getMyGroupsSubmissions(mockUser, {});

      expect(result.summary.weeklyAttendanceTotal).toBe(15);
    });
  });

  describe('submitReport - weekly duplicate limit', () => {
    const mockUser = { id: 7, contactId: 3 } as any;

    const baseReport = {
      id: 1,
      name: 'Weekly Report',
      status: ReportStatus.ACTIVE,
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

    it('blocks a second submission of the same report for the same group in the same week', async () => {
      mockRepositories.groupTree.findOne.mockResolvedValue(
        makeGroup(10, 'MC Nairobi'),
      );
      // Simulate an existing submission already on file for group 10.
      mockRepositories.reportSubmission.findOne.mockResolvedValue({
        id: 55,
        report: { id: 1 },
        group: { id: 10 },
      });

      await expect(
        service.submitReport(1, { data: { groupId: '10' } }, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            report: { id: 1 },
            group: { id: 10 },
          }),
        }),
      );
      expect(mockRepositories.reportSubmission.save).not.toHaveBeenCalled();
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
            report: { id: 1 },
            group: { id: 11 },
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
      });

      await expect(
        service.submitReport(1, { data: {} }, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepositories.reportSubmission.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            report: { id: 1 },
            user: { id: 7 },
          }),
        }),
      );
    });
  });
});
