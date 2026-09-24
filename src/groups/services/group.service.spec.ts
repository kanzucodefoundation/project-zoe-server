import { Test, TestingModule } from '@nestjs/testing';
import { In } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import { GroupsService } from './groups.service';
import { GroupPermissionsService } from './group-permissions.service';
import { GoogleService } from '../../vendor/google.service';
import { AppLogger } from '../../utils/app-logger.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AfricasTalkingService } from '../../vendor/africas-talking.service';
import Group from '../entities/group.entity';
import GroupMembership from '../entities/groupMembership.entity';
import GroupEvent from '../../events/entities/event.entity';
import GroupCategory from '../entities/groupCategory.entity';
import Phone from '../../crm/entities/phone.entity';
import { FellowshipSchedule } from '../../attendance/entities/fellowship-schedule.entity';

let tenantAwareGroupRepoForTest: any;
jest.mock('../../shared/repository/tenant-aware.repository', () => ({
  TenantAwareRepository: jest
    .fn()
    .mockImplementation(() => tenantAwareGroupRepoForTest),
}));

describe('GroupsService', () => {
  let service: GroupsService;
  let mockRepositories: any;
  let mockDataSource: any;
  let mockGroupsPermissionsService: any;
  let mockGoogleService: Partial<GoogleService>;
  let mockAfricasTalkingService: Partial<AfricasTalkingService>;
  let mockTenantContext: Partial<TenantContext>;
  let mockTenantAwareGroupRepo: any;

  beforeEach(async () => {
    mockRepositories = {
      group: {
        find: jest.fn(),
        findOne: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      membership: {
        find: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      event: {
        find: jest.fn(),
      },
      category: {
        find: jest.fn(),
        findOne: jest.fn(),
      },
      phone: {},
      fellowshipSchedule: {
        save: jest.fn(),
        create: jest.fn((data) => data),
      },
    };

    mockDataSource = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Group) return mockRepositories.group;
        if (entity === GroupMembership) return mockRepositories.membership;
        if (entity === GroupEvent) return mockRepositories.event;
        if (entity === GroupCategory) return mockRepositories.category;
        if (entity === Phone) return mockRepositories.phone;
        if (entity === FellowshipSchedule)
          return mockRepositories.fellowshipSchedule;
        return {};
      }),
      getTreeRepository: jest.fn(() => ({})),
    };

    mockGroupsPermissionsService = {
      getAccessibleGroupIds: jest.fn(),
      getUserGroupIds: jest.fn(),
      getUserIsMemberLeaderGroupIds: jest.fn(),
      assertPermissionForGroup: jest.fn(),
      hasPermissionForGroup: jest.fn(),
      getContactLocationGroupId: jest.fn(),
      getDescendantGroupIds: jest.fn(),
    };

    mockGoogleService = { getPlaceDetails: jest.fn() };
    mockAfricasTalkingService = {
      normalizePhoneNumber: jest.fn((v: string) => v),
      sendBulkSms: jest.fn(),
    };
    mockTenantContext = {
      requireTenant: jest.fn().mockReturnValue(1),
      tenantId: 1,
    } as any;

    mockTenantAwareGroupRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    tenantAwareGroupRepoForTest = mockTenantAwareGroupRepo;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        { provide: GroupPermissionsService, useValue: mockGroupsPermissionsService },
        { provide: GoogleService, useValue: mockGoogleService },
        {
          provide: AppLogger,
          useValue: {
            createContextLogger: jest.fn(() => ({
              business: jest.fn(),
              security: jest.fn(),
              error: jest.fn(),
              startTracking: jest.fn(() => ({})),
              endTracking: jest.fn(),
            })),
          },
        },
        { provide: TenantContext, useValue: mockTenantContext },
        { provide: AfricasTalkingService, useValue: mockAfricasTalkingService },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGroupMembers', () => {
    it('throws when the user lacks permission for the group', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        false,
      );

      await expect(
        service.getGroupMembers(1, { id: 1 }),
      ).rejects.toThrow(ClientFriendlyException);
    });

    it('returns paginated members mapped to a simple shape', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      const membershipQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            contact: {
              id: 10,
              person: { firstName: 'Ann', lastName: 'Otim' },
              emails: [],
            },
            role: 'Member',
            joinedAt: new Date('2024-01-01'),
          },
        ]),
      };
      mockRepositories.membership.createQueryBuilder.mockReturnValue(
        membershipQb,
      );
      mockRepositories.membership.count.mockResolvedValue(1);

      const result = await service.getGroupMembers(1, { id: 1 }, 20, 0);

      expect(membershipQb.skip).toHaveBeenCalledWith(0);
      expect(membershipQb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        members: [
          {
            id: 10,
            fullName: 'Ann Otim',
            role: 'Member',
            joinedAt: new Date('2024-01-01'),
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('falls back to email when the contact has no person record', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      const membershipQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            contact: {
              id: 11,
              person: null,
              emails: [{ value: 'noone@test.com' }],
            },
            role: 'Member',
            joinedAt: new Date('2024-01-01'),
          },
        ]),
      };
      mockRepositories.membership.createQueryBuilder.mockReturnValue(
        membershipQb,
      );
      mockRepositories.membership.count.mockResolvedValue(1);

      const result = await service.getGroupMembers(1, { id: 1 });

      expect(result.members[0].fullName).toBe('noone@test.com');
    });
  });

  describe('getGroupSmsInfo', () => {
    it('throws when the user lacks permission for the group', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        false,
      );

      await expect(
        service.getGroupSmsInfo(1, { id: 1 }),
      ).rejects.toThrow(ClientFriendlyException);
    });

    it('counts members with and without a phone number', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockRepositories.membership.find.mockResolvedValueOnce([
        { contact: { phones: [{ value: '0700000000' }] } },
        { contact: { phones: [] } },
        { contact: { phones: undefined } },
      ]);

      const result = await service.getGroupSmsInfo(1, { id: 1 });

      expect(result).toEqual({
        totalMembers: 3,
        membersWithPhone: 1,
        membersWithoutPhone: 2,
      });
    });
  });

  describe('sendGroupSms', () => {
    const user = { id: 1 };

    it('throws NotFoundException when the group does not exist', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce(null);

      await expect(
        service.sendGroupSms(1, 'hello', user),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the user lacks permission for the group', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce({
        id: 1,
        name: 'Group A',
      });
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        false,
      );

      await expect(
        service.sendGroupSms(1, 'hello', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty message', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce({
        id: 1,
        name: 'Group A',
      });
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );

      await expect(
        service.sendGroupSms(1, '   ', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a group with no active members', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce({
        id: 1,
        name: 'Group A',
      });
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockRepositories.membership.find.mockResolvedValueOnce([]);

      await expect(
        service.sendGroupSms(1, 'hello', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips members with no valid phone number and sends to the rest', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce({
        id: 1,
        name: 'Group A',
      });
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockRepositories.membership.find.mockResolvedValueOnce([
        {
          contactId: 1,
          contact: { phones: [{ isPrimary: true, value: '0700000001' }] },
        },
        { contactId: 2, contact: { phones: [] } },
      ]);
      (mockAfricasTalkingService.normalizePhoneNumber as jest.Mock)
        .mockReturnValueOnce('+256700000001');
      (mockAfricasTalkingService.sendBulkSms as jest.Mock).mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0,
      });

      const result = await service.sendGroupSms(1, 'hello', user);

      expect(mockAfricasTalkingService.sendBulkSms).toHaveBeenCalledWith(
        ['+256700000001'],
        'hello',
      );
      expect(result).toEqual({
        success: true,
        sentCount: 1,
        totalMembers: 2,
        skippedCount: 1,
      });
    });

    it('throws when every phone number fails to normalize', async () => {
      mockRepositories.group.findOne.mockResolvedValueOnce({
        id: 1,
        name: 'Group A',
      });
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockRepositories.membership.find.mockResolvedValueOnce([
        {
          contactId: 1,
          contact: { phones: [{ isPrimary: true, value: 'bad-number' }] },
        },
      ]);
      (mockAfricasTalkingService.normalizePhoneNumber as jest.Mock)
        .mockReturnValueOnce(null);

      await expect(
        service.sendGroupSms(1, 'hello', user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getContactLocationGroup', () => {
    const requestingUser = { id: 1 };

    it('returns null when the contact has no location group, without checking permissions', async () => {
      mockGroupsPermissionsService.getContactLocationGroupId.mockResolvedValueOnce(
        null,
      );

      const result = await service.getContactLocationGroup(5, requestingUser);

      expect(result).toBeNull();
      expect(
        mockGroupsPermissionsService.hasPermissionForGroup,
      ).not.toHaveBeenCalled();
      expect(mockTenantAwareGroupRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws when the requesting user lacks permission for the resolved location group', async () => {
      mockGroupsPermissionsService.getContactLocationGroupId.mockResolvedValueOnce(
        3,
      );
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        false,
      );

      await expect(
        service.getContactLocationGroup(5, requestingUser),
      ).rejects.toThrow(ClientFriendlyException);
      expect(
        mockGroupsPermissionsService.hasPermissionForGroup,
      ).toHaveBeenCalledWith(requestingUser, 3);
      expect(mockTenantAwareGroupRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns the id/name of the resolved location group when the user has access', async () => {
      mockGroupsPermissionsService.getContactLocationGroupId.mockResolvedValueOnce(
        3,
      );
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockTenantAwareGroupRepo.findOne.mockResolvedValueOnce({
        id: 3,
        name: 'Downtown',
      });

      const result = await service.getContactLocationGroup(5, requestingUser);

      expect(result).toEqual({ id: 3, name: 'Downtown' });
      expect(mockTenantAwareGroupRepo.findOne).toHaveBeenCalledWith({
        where: { id: 3 },
        select: ['id', 'name'],
      });
    });
  });

  describe('findAll — sameLocation scoping', () => {
    it("scopes purpose-filtered groups to the requesting user's own location", async () => {
      mockGroupsPermissionsService.getContactLocationGroupId.mockResolvedValueOnce(
        2,
      );
      mockGroupsPermissionsService.getDescendantGroupIds.mockResolvedValueOnce(
        [20, 21],
      );
      const purposeQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepositories.group.createQueryBuilder.mockReturnValue(purposeQb);

      await service.findAll(
        { purpose: 'Fellowship', sameLocation: true } as any,
        { contactId: 7 },
      );

      expect(
        mockGroupsPermissionsService.getContactLocationGroupId,
      ).toHaveBeenCalledWith(7);
      expect(purposeQb.andWhere).toHaveBeenCalledWith(
        'group.id IN (:...accessibleGroupIds)',
        { accessibleGroupIds: [2, 20, 21] },
      );
    });

    it('returns an empty array when the requesting user has no location group', async () => {
      mockGroupsPermissionsService.getContactLocationGroupId.mockResolvedValueOnce(
        null,
      );

      const result = await service.findAll(
        { purpose: 'Fellowship', sameLocation: true } as any,
        { contactId: 7 },
      );

      expect(result).toEqual([]);
      expect(mockRepositories.group.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne — child groups', () => {
    // 1 (root)
    // +- 2
    // +- 3
    //    +- 4   <- grandchild: belongs on group 3's page, not group 1's
    beforeEach(() => {
      mockRepositories.group.findOne.mockResolvedValue({
        id: 1,
        name: 'Region',
        parentId: null,
        category: { id: 9, name: 'Region' },
      });
      // Child/descendant lookups must go through the tenant-aware repository,
      // so leave the raw repository unmocked here — a call to it would throw.
      mockTenantAwareGroupRepo.find.mockImplementation(
        ({ where }: any) =>
          ({
            1: [{ id: 2 }, { id: 3 }],
            3: [{ id: 4 }],
          })[where.parentId] ?? [],
      );
      mockRepositories.event.find.mockResolvedValue([]);
      mockRepositories.membership.find.mockResolvedValue([]);
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValue(
        true,
      );
    });

    it('returns only direct children, not the whole subtree', async () => {
      const result = await service.findOne(1, true, { id: 1 });

      expect(result.children).toEqual([2, 3]);
    });

    it('resolves children through the tenant-scoped repository', async () => {
      await service.findOne(1, true, { id: 1 });

      expect(mockTenantAwareGroupRepo.find).toHaveBeenCalledWith({
        where: { parentId: 1 },
        select: ['id'],
      });
      expect(mockRepositories.group.find).not.toHaveBeenCalled();
    });

    it('still rolls attendance up over the full subtree including itself', async () => {
      await service.findOne(1, true, { id: 1 });

      const eventQuery = mockRepositories.event.find.mock.calls[0][0];
      expect(eventQuery.where.groupId).toEqual(In([1, 2, 3, 4]));
    });
  });
});
