import { Test, TestingModule } from '@nestjs/testing';
import { GroupPermissionsService } from './group-permissions.service';
import { Connection } from 'typeorm';
import Group from '../entities/group.entity';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import { roleAdmin } from '../../auth/constants';

describe('GroupPermissionsService', () => {
  let service: GroupPermissionsService;
  let mockMembershipRepo: any;
  let mockGroupRepo: any;
  let mockTreeRepo: any;

  const adminUser = { contactId: 1, roles: [roleAdmin.role] };
  const regularUser = { contactId: 2, roles: [] };

  beforeEach(async () => {
    mockMembershipRepo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    mockGroupRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockTreeRepo = {
      findAncestors: jest.fn().mockResolvedValue([]),
      findDescendants: jest.fn().mockResolvedValue([]),
    };

    const mockConnection = {
      getRepository: jest.fn((entity) => {
        if (entity === Group) return mockGroupRepo;
        return mockMembershipRepo;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockTreeRepo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupPermissionsService,
        { provide: 'CONNECTION', useValue: mockConnection },
      ],
    }).compile();

    service = module.get<GroupPermissionsService>(GroupPermissionsService);
  });

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
      const targetGroup = { id: 42, name: 'MC' } as Group;
      const parentGroup = { id: 10, name: 'Zone' } as Group;
      mockMembershipRepo.count
        .mockResolvedValueOnce(0) // not a direct leader
        .mockResolvedValueOnce(1); // leads an ancestor
      mockGroupRepo.findOne.mockResolvedValue(targetGroup);
      mockTreeRepo.findAncestors.mockResolvedValue([parentGroup]);

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
      const targetGroup = { id: 42 } as Group;
      mockMembershipRepo.count.mockResolvedValue(0);
      mockGroupRepo.findOne.mockResolvedValue(targetGroup);
      mockTreeRepo.findAncestors.mockResolvedValue([{ id: 10 }]);

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
      mockTreeRepo.findDescendants
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
      mockTreeRepo.findDescendants
        .mockResolvedValueOnce([{ id: 30 }])
        .mockResolvedValueOnce([{ id: 30 }]); // same child appears under both groups

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
    it('includes groups where user is a member (not just leader)', async () => {
      mockMembershipRepo.find.mockResolvedValue([{ groupId: 5 }]);
      mockTreeRepo.findDescendants.mockResolvedValue([]);

      const ids = await service.getUserIsMemberLeaderGroupIds(regularUser);

      expect(ids).toContain(5);
      expect(mockMembershipRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactId: regularUser.contactId,
          }),
        }),
      );
    });
  });
});
