import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityService } from '../crm/contact-activity.service';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import { roleAdmin } from '../auth/constants';

// TenantAwareRepository requires a real TypeORM EntityManager; intercept its
// constructor so the test can supply mockGroupRepo without a live connection.
let groupRepoForTest: any;
jest.mock('../shared/repository/tenant-aware.repository', () => ({
  TenantAwareRepository: jest.fn().mockImplementation(() => groupRepoForTest),
}));

const TENANT_ID = 1;

function createChainableQb(terminalMethods: Record<string, jest.Mock>) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    ...terminalMethods,
  } as any;
}

describe('TasksService — location-based visibility scoping', () => {
  let service: TasksService;
  let mockGroupPermissionsService: {
    getAccessibleGroupIds: jest.Mock;
  };
  let mockTaskRepo: any;
  let mockCommentRepo: any;
  let mockMembershipRepo: any;
  let mockGroupRepo: any;
  let taskQb: any;
  let groupQb: any;
  let membershipQb: any;
  let commentQb: any;

  const buildUser = (overrides: Record<string, any> = {}) => ({
    id: 100,
    contactId: 10,
    roles: [],
    ...overrides,
  });

  const buildAdmin = () => buildUser({ roles: [roleAdmin.role] });

  beforeEach(async () => {
    taskQb = createChainableQb({
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });
    groupQb = createChainableQb({
      getMany: jest.fn().mockResolvedValue([]),
    });
    membershipQb = createChainableQb({
      getCount: jest.fn().mockResolvedValue(0),
    });
    commentQb = createChainableQb({
      getRawMany: jest.fn().mockResolvedValue([]),
    });

    mockTaskRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(taskQb),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    mockCommentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(commentQb),
      find: jest.fn().mockResolvedValue([]),
    };
    mockMembershipRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(membershipQb),
    };
    mockGroupRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(groupQb),
    };
    // Must be set before module.compile() so the TenantAwareRepository mock
    // returns the current mockGroupRepo when the service is constructed.
    groupRepoForTest = mockGroupRepo;

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Task) return mockTaskRepo;
        if (entity === TaskComment) return mockCommentRepo;
        if (entity === TaskAttachment) return {};
        if (entity === GroupMembership) return mockMembershipRepo;
        throw new Error(`Unexpected entity requested: ${entity}`);
      }) as any,
      manager: {} as any,
      transaction: jest.fn((fn: any) => fn({})) as any,
    };

    mockGroupPermissionsService = {
      getAccessibleGroupIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: 'CONNECTION', useValue: mockConnection },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(TENANT_ID) },
        },
        {
          provide: ContactActivityService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: GroupPermissionsService,
          useValue: mockGroupPermissionsService,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('findAll', () => {
    it('is unrestricted for admins and never queries the group hierarchy', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue(null);

      await service.findAll(1, 20, {}, buildAdmin());

      expect(mockGroupRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockTaskRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('returns an empty page without querying tasks when the user has no accessible groups', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([]);

      const result = await service.findAll(1, 20, {}, buildUser());

      expect(result).toEqual({ data: [], groups: [], total: 0 });
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('scopes tasks to a single location for a direct location leader', async () => {
      // getAccessibleGroupIds already expands leadership to include descendants
      // (GroupPermissionsService.getUserGroupIds); a location leader's only
      // LOCATION-purpose descendant is their own location.
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([55]);
      groupQb.getMany.mockResolvedValue([{ id: 55 }]);

      await service.findAll(1, 20, {}, buildUser());

      expect(mockGroupRepo.createQueryBuilder).toHaveBeenCalledWith('group');
      expect(taskQb.andWhere).toHaveBeenCalledWith(expect.any(Function));
    });

    it('scopes tasks across every location beneath a higher-level (e.g. FOB) leader', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([
        1, 30, 40, 999,
      ]);
      // Only the LOCATION-purpose groups among the accessible ids survive.
      groupQb.getMany.mockResolvedValue([{ id: 30 }, { id: 40 }]);

      await service.findAll(1, 20, {}, buildUser());

      expect(taskQb.andWhere).toHaveBeenCalledWith(expect.any(Function));
    });

    it('intersects a client-supplied locationGroupIds filter with the accessible set instead of trusting it outright', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([
        30, 40,
      ]);
      groupQb.getMany.mockResolvedValue([{ id: 30 }, { id: 40 }]);

      await service.findAll(
        1,
        20,
        { locationGroupIds: [40, 9999] },
        buildUser(),
      );

      // 40 is a legitimate overlap, so the query still runs.
      expect(mockTaskRepo.createQueryBuilder).toHaveBeenCalled();

      // Inspect the subquery the callback builds to confirm it only binds
      // the effective intersection ([40]), never the untrusted 9999.
      const andWhereCallback = taskQb.andWhere.mock.calls
        .map(([arg]: [any]) => arg)
        .find((arg: any) => typeof arg === 'function');
      expect(andWhereCallback).toBeDefined();

      const subQb = createChainableQb({
        from: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('SELECT 1'),
      });
      const subQueryBuilder = { subQuery: jest.fn().mockReturnValue(subQb) };
      andWhereCallback(subQueryBuilder);

      const locationFilterCall = subQb.andWhere.mock.calls.find(
        ([, params]: [string, any]) => params?.locationGroupIds,
      );
      expect(locationFilterCall[1]).toEqual({ locationGroupIds: [40] });
    });

    it('returns an empty page when the requested locationGroupIds do not overlap the accessible set', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([30]);
      groupQb.getMany.mockResolvedValue([{ id: 30 }]);

      const result = await service.findAll(
        1,
        20,
        { locationGroupIds: [9999] },
        buildUser(),
      );

      expect(result).toEqual({ data: [], groups: [], total: 0 });
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const TASK_ID = 5;
    const CONTACT_ID = 77;

    const mockTask = () => ({
      id: TASK_ID,
      contact: { id: CONTACT_ID },
      assignedTo: null,
      createdBy: null,
      comments: [],
    });

    it('throws NotFoundException before checking location access when the task does not exist', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TASK_ID, buildUser())).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockGroupPermissionsService.getAccessibleGroupIds,
      ).not.toHaveBeenCalled();
    });

    it('lets an admin view any task regardless of location', async () => {
      mockTaskRepo.findOne.mockResolvedValue(mockTask());
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue(null);

      const result = await service.findOne(TASK_ID, buildAdmin());

      expect(result.id).toBe(TASK_ID);
    });

    it('lets a location leader view a task for a contact in their location', async () => {
      mockTaskRepo.findOne.mockResolvedValue(mockTask());
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([55]);
      groupQb.getMany.mockResolvedValue([{ id: 55 }]);
      membershipQb.getCount.mockResolvedValue(1);

      const result = await service.findOne(TASK_ID, buildUser());

      expect(result.id).toBe(TASK_ID);
    });

    it('throws ForbiddenException when the task belongs to a contact outside the accessible locations', async () => {
      mockTaskRepo.findOne.mockResolvedValue(mockTask());
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([55]);
      groupQb.getMany.mockResolvedValue([{ id: 55 }]);
      membershipQb.getCount.mockResolvedValue(0);

      await expect(service.findOne(TASK_ID, buildUser())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException immediately when the user has no accessible location groups at all', async () => {
      mockTaskRepo.findOne.mockResolvedValue(mockTask());
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([]);

      await expect(service.findOne(TASK_ID, buildUser())).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockMembershipRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findAllForContact', () => {
    const CONTACT_ID = 77;

    it('returns tasks when the user has access to the contact location', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([55]);
      groupQb.getMany.mockResolvedValue([{ id: 55 }]);
      membershipQb.getCount.mockResolvedValue(1);
      mockTaskRepo.find.mockResolvedValue([]);

      const result = await service.findAllForContact(CONTACT_ID, buildUser());

      expect(result).toEqual([]);
      expect(mockTaskRepo.find).toHaveBeenCalled();
    });

    it('throws ForbiddenException and never queries tasks when the user lacks access to the contact location', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue([55]);
      groupQb.getMany.mockResolvedValue([{ id: 55 }]);
      membershipQb.getCount.mockResolvedValue(0);

      await expect(
        service.findAllForContact(CONTACT_ID, buildUser()),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTaskRepo.find).not.toHaveBeenCalled();
    });

    it('lets an admin view any contact tasks without a location check', async () => {
      mockGroupPermissionsService.getAccessibleGroupIds.mockResolvedValue(null);
      mockTaskRepo.find.mockResolvedValue([]);

      await service.findAllForContact(CONTACT_ID, buildAdmin());

      expect(mockGroupRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockTaskRepo.find).toHaveBeenCalled();
    });
  });
});
