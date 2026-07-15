import { Test, TestingModule } from '@nestjs/testing';
import { GroupPermissionsService } from './group-permissions.service';
import { Connection } from 'typeorm';
import Group from '../entities/group.entity';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import { roleAdmin } from '../../auth/constants';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { TenantAwareRepository } from '../../shared/repository/tenant-aware.repository';

jest.mock('../../shared/repository/tenant-aware.repository');

describe('GroupPermissionsService', () => {
  let service: GroupPermissionsService;
  let mockMembershipRepo: any;
  let mockGroupRepo: any;
  let mockConnection: any;
  let mockTenantContext: any;

  const adminUser = { contactId: 1, roles: [roleAdmin.role] };
  const regularUser = { contactId: 2, roles: [] };

  beforeEach(async () => {
    mockMembershipRepo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    mockGroupRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    (TenantAwareRepository as jest.Mock).mockImplementation(() => mockGroupRepo);

    mockConnection = {
      getRepository: jest.fn((entity) => {
        if (entity === GroupMembership) return mockMembershipRepo;
        return mockGroupRepo;
      }),
      manager: {},
    };

    mockTenantContext = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupPermissionsService,
        { provide: 'CONNECTION', useValue: mockConnection },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<GroupPermissionsService>(GroupPermissionsService);
  });

  it('constructs the Group repository as tenant-aware with correct args', () => {
    expect(TenantAwareRepository).toHaveBeenCalledWith(
      Group,
      mockConnection.manager,
      mockTenantContext,
    );
  });
  // ...rest of the describe blocks unchanged

  describe('hasPermissionForGroup', () => {
    it('returns true for admin users without hitting the database', async () => {
      const result = await service.hasPermissionForGroup(adminUser, 42);

      expect(result).toBe(true);
      expect(mockMembershipRepo.count).not.toHaveBeenCalled();
    });

    it('returns true when user is a direct leader of the group', async () => {
      mockMembershipRepo.count.mockResolvedValue(1);

      const result = await service.hasPermissionForGroup(regularUser, 42);

      expect(result).toBe(true);
      expect(mockMembershipRepo.count).toHaveBeenCalledWith({
        where: {
          contactId: regularUser.contactId,
          role: GroupRole.Leader,
          groupId: 42,
        },
      });
    });

    it('returns true when user leads an ancestor group', async () => {
      // Fix 2: Provide a clear parentId chain so the manual while loop resolves ancestors correctly
      const targetGroup = { id: 42, name: 'MC', parentId: 10 } as Group;
      const parentGroup = { id: 10, name: 'Zone', parentId: null } as Group;
      
      mockMembershipRepo.count
        .mockResolvedValueOnce(0) // not a direct leader
        .mockResolvedValueOnce(1); // leads an ancestor
        
      mockGroupRepo.findOne
        .mockResolvedValueOnce(targetGroup) // first hit for target group
        .mockResolvedValueOnce(parentGroup); // second hit for ancestor tracking lookup

      const result = await service.hasPermissionForGroup(regularUser, 42);

      expect(result).toBe(true);
    });

    it('returns false when group does not exist', async () => {
      mockMembershipRepo.count.mockResolvedValue(0);
      mockGroupRepo.findOne.mockResolvedValue(null);

      const result = await service.hasPermissionForGroup(regularUser, 999);

      expect(result).toBe(false);
    });

    it('returns false when user leads neither the group nor any ancestor', async () => {
      const targetGroup = { id: 42, parentId: 10 } as Group;
      const parentGroup = { id: 10, parentId: null } as Group;
      mockMembershipRepo.count.mockResolvedValue(0);
      
      mockGroupRepo.findOne
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(parentGroup);

      const result = await service.hasPermissionForGroup(regularUser, 42);

      expect(result).toBe(false);
    });
  });

  describe('assertPermissionForGroup', () => {
    it('does not throw when user has permission', async () => {
      mockMembershipRepo.count.mockResolvedValue(1);

      await expect(
        service.assertPermissionForGroup(regularUser, 42),
      ).resolves.not.toThrow();
    });

    it('throws ClientFriendlyException when user lacks permission', async () => {
      mockMembershipRepo.count.mockResolvedValue(0);
      mockGroupRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertPermissionForGroup(regularUser, 42),
      ).rejects.toThrow(ClientFriendlyException);
    });
  });

  describe('getUserGroupIds', () => {
    it('returns direct and descendant group IDs', async () => {
      mockMembershipRepo.find.mockResolvedValue([
        { groupId: 10 },
        { groupId: 20 },
      ]);
      
      // Fix 3: Simulate our new manual child finder (.find returning explicit nested group ids)
      mockGroupRepo.find
        .mockResolvedValueOnce([{ id: 11 }, { id: 12 }]) // children of group 10
        .mockResolvedValueOnce([]); // group 20 has no children

      const ids = await service.getUserGroupIds(regularUser);

      expect(ids).toEqual(expect.arrayContaining([10, 11, 12, 20]));
      expect(ids).toHaveLength(4);
    });

    it('deduplicates group IDs when a group appears in multiple hierarchies', async () => {
      mockMembershipRepo.find.mockResolvedValue([
        { groupId: 10 },
        { groupId: 20 },
      ]);
      
      // Fix 4: Simulate duplicate children mapping over the manual lookups
      mockGroupRepo.find
        .mockResolvedValueOnce([{ id: 30 }])
        .mockResolvedValueOnce([{ id: 30 }]);

      const ids = await service.getUserGroupIds(regularUser);

      expect(ids.filter((id) => id === 30)).toHaveLength(1);
    });

    it('returns empty array when user has no group memberships', async () => {
      mockMembershipRepo.find.mockResolvedValue([]);

      const ids = await service.getUserGroupIds(regularUser);

      expect(ids).toEqual([]);
    });
  });

  describe('getUserIsMemberLeaderGroupIds', () => {
  it('delegates to getUserGroupIds: excludes Member rows, expands Leader descendants', async () => {
    // Only Leader rows should reach this query, per getUserGroupIds' where clause;
    // simulate the DB already filtering to Leader role, plus one Leader group with a child
    mockMembershipRepo.find.mockResolvedValue([{ groupId: 5 }]); // leader of group 5
    mockGroupRepo.find.mockResolvedValueOnce([{ id: 50 }]); // group 5 has child 50

    const ids = await service.getUserIsMemberLeaderGroupIds(regularUser);

    expect(ids).toEqual(expect.arrayContaining([5, 50]));
    expect(ids).toHaveLength(2);
    expect(mockMembershipRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contactId: regularUser.contactId,
          role: GroupRole.Leader,
        }),
      }),
    );
  });
});
});
