import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ContactsService } from '../crm/contacts.service';
import { JwtHelperService } from '../auth/jwt-helpers.service';
import { GroupsMembershipService } from '../groups/services/group-membership.service';
import { TenantContext } from '../shared/tenant/tenant-context';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import { Connection } from 'typeorm';
import Email from '../crm/entities/email.entity';
import Roles from './entities/roles.entity';
import UserRoles from './entities/userRoles.entity';
import Person from '../crm/entities/person.entity';
import Group from '../groups/entities/group.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { GroupRole } from '../groups/enums/groupRole';

// TenantAwareRepository requires a real TypeORM EntityManager; intercept its
// constructor so the test can supply mockGroupRepo without a live connection
// (mirrors the approach used in tasks.service.spec.ts).
let groupRepoForTest: any;
jest.mock('../shared/repository/tenant-aware.repository', () => ({
  TenantAwareRepository: jest.fn().mockImplementation(() => groupRepoForTest),
}));

describe('UsersService', () => {
  let service: UsersService;
  let mockConnection: Partial<Connection>;
  let mockContactsService: Partial<ContactsService>;
  let mockJwtHelperService: Partial<JwtHelperService>;
  let mockGroupsPermissionsService: { hasPermissionForGroup: jest.Mock };
  let mockRepositories: any;
  let mockGroupRepo: any;
  let mockMembershipQb: any;
  let mockUpdateQb: any;

  beforeEach(async () => {
    mockMembershipQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockUpdateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    // groupRepository is a TenantAwareRepository<Group> constructed once in
    // the UsersService constructor (see the jest.mock interception above),
    // so findNearestFobAncestor's lookups land on this mock's `findOne`.
    mockGroupRepo = {
      findOne: jest.fn(),
    };
    groupRepoForTest = mockGroupRepo;

    // Create mock repositories
    mockRepositories = {
      user: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(mockUpdateQb),
      },
      email: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      },
      roles: {
        find: jest.fn(),
      },
      userRoles: {
        find: jest.fn(),
        save: jest.fn(),
      },
      person: {
        find: jest.fn(),
      },
      // membershipRepository is a plain Repository<GroupMembership>
      // constructed via connection.getRepository(GroupMembership).
      membership: {
        createQueryBuilder: jest.fn().mockReturnValue(mockMembershipQb),
      },
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === User) return mockRepositories.user;
        if (entity === Email) return mockRepositories.email;
        if (entity === Roles) return mockRepositories.roles;
        if (entity === UserRoles) return mockRepositories.userRoles;
        if (entity === Person) return mockRepositories.person;
        if (entity === GroupMembership) return mockRepositories.membership;
        return mockRepositories.user;
      }),
      manager: {} as any,
    };

    // Create mock services
    mockContactsService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockJwtHelperService = {
      generateToken: jest.fn(),
      decodeToken: jest.fn(),
    };

    mockGroupsPermissionsService = {
      hasPermissionForGroup: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: ContactsService,
          useValue: mockContactsService,
        },
        {
          provide: JwtHelperService,
          useValue: mockJwtHelperService,
        },
        {
          provide: GroupsMembershipService,
          useValue: { create: jest.fn(), findAll: jest.fn() },
        },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
        {
          provide: GroupPermissionsService,
          useValue: mockGroupsPermissionsService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize repositories correctly', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(User);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Email);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Roles);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(UserRoles);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Person);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
  });

  it('should create new user', async () => {
    const userData = {
      id: 1,
      username: 'test',
      password: 'testPassword',
      contactId: 1,
      isActive: true,
    };

    const mockUser = new User();
    Object.assign(mockUser, userData);

    mockRepositories.user.create.mockReturnValue(mockUser);
    mockRepositories.user.save.mockResolvedValue(mockUser);

    const result = await service.create(mockUser);
    expect(result).toBeDefined();
    expect(mockRepositories.user.save).toHaveBeenCalled();
  });

  describe('findUsersInGroup', () => {
    const requestingUser = { id: 1 };

    it('throws ForbiddenException and never queries memberships when the user lacks permission', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        false,
      );

      await expect(service.findUsersInGroup(5, requestingUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(
        mockRepositories.membership.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('scopes to a single group when no FOB ancestor exists', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockGroupRepo.findOne.mockResolvedValueOnce({
        id: 5,
        parentId: null,
        category: { name: 'Location' },
      });
      mockMembershipQb.getMany.mockResolvedValueOnce([
        { contactId: 1 },
        { contactId: 2 },
      ]);
      mockRepositories.user.find.mockResolvedValueOnce([
        {
          id: 1,
          contactId: 1,
          userRoles: [],
          contact: { person: { firstName: 'A', lastName: 'B' } },
        },
        {
          id: 2,
          contactId: 2,
          userRoles: [],
          contact: { person: { firstName: 'C', lastName: 'D' } },
        },
      ]);

      const result = await service.findUsersInGroup(5, requestingUser);

      expect(mockMembershipQb.andWhere).toHaveBeenCalledWith(
        'membership.groupId = :groupId',
        expect.objectContaining({ groupId: 5, fobGroupId: undefined }),
      );
      expect(result).toHaveLength(2);
    });

    it('also includes FOB leaders when an ancestor FOB group is found by walking up parentId', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockGroupRepo.findOne
        .mockResolvedValueOnce({
          id: 5,
          parentId: 4,
          category: { name: 'Location' },
        })
        .mockResolvedValueOnce({
          id: 4,
          parentId: null,
          category: { name: 'FOB' },
        });
      mockMembershipQb.getMany.mockResolvedValueOnce([{ contactId: 3 }]);
      mockRepositories.user.find.mockResolvedValueOnce([
        {
          id: 3,
          contactId: 3,
          userRoles: [],
          contact: { person: { firstName: 'E', lastName: 'F' } },
        },
      ]);

      const result = await service.findUsersInGroup(5, requestingUser);

      expect(mockGroupRepo.findOne).toHaveBeenCalledTimes(2);
      expect(mockMembershipQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('membership.groupId = :fobGroupId'),
        expect.objectContaining({
          groupId: 5,
          fobGroupId: 4,
          leaderRole: GroupRole.Leader,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('stops walking up the tree if a parent group is missing', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockGroupRepo.findOne.mockResolvedValueOnce(undefined);
      mockMembershipQb.getMany.mockResolvedValueOnce([]);

      await service.findUsersInGroup(99, requestingUser);

      // Only the initial lookup should have run; the walk stops as soon as
      // the group comes back falsy.
      expect(mockGroupRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('does not loop forever if the parent chain cycles back on itself', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      // 5 -> 6 -> 5 ... a corrupt/cyclic parentId chain should not hang.
      mockGroupRepo.findOne
        .mockResolvedValueOnce({
          id: 5,
          parentId: 6,
          category: { name: 'Location' },
        })
        .mockResolvedValueOnce({
          id: 6,
          parentId: 5,
          category: { name: 'Location' },
        });
      mockMembershipQb.getMany.mockResolvedValueOnce([]);

      await service.findUsersInGroup(5, requestingUser);

      expect(mockGroupRepo.findOne).toHaveBeenCalledTimes(2);
      expect(mockMembershipQb.andWhere).toHaveBeenCalledWith(
        'membership.groupId = :groupId',
        expect.objectContaining({ fobGroupId: undefined }),
      );
    });

    it('returns an empty array without querying users when the group has no members', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockGroupRepo.findOne.mockResolvedValueOnce({
        id: 9,
        parentId: null,
        category: { name: 'Location' },
      });
      mockMembershipQb.getMany.mockResolvedValueOnce([]);

      const result = await service.findUsersInGroup(9, requestingUser);

      expect(result).toEqual([]);
      expect(mockRepositories.user.find).not.toHaveBeenCalled();
    });

    it('de-duplicates repeated contact ids from the membership rows', async () => {
      mockGroupsPermissionsService.hasPermissionForGroup.mockResolvedValueOnce(
        true,
      );
      mockGroupRepo.findOne.mockResolvedValueOnce({
        id: 5,
        parentId: null,
        category: { name: 'Location' },
      });
      mockMembershipQb.getMany.mockResolvedValueOnce([
        { contactId: 1 },
        { contactId: 1 },
      ]);
      mockRepositories.user.find.mockResolvedValueOnce([
        {
          id: 1,
          contactId: 1,
          userRoles: [],
          contact: { person: { firstName: 'A', lastName: 'B' } },
        },
      ]);

      const result = await service.findUsersInGroup(5, requestingUser);

      // Only one user should be requested/returned even though the same
      // contactId appeared twice in the membership rows.
      expect(mockRepositories.user.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    const buildUser = (overrides: Partial<User> = {}): any => ({
      id: 1,
      contactId: 10,
      username: 'old@example.com',
      email: 'old@example.com',
      isActive: true,
      userRoles: [],
      contact: { person: { firstName: 'A', lastName: 'B' } },
      ...overrides,
    });

    it('updates isActive without touching email/username', async () => {
      mockRepositories.user.findOne
        .mockResolvedValueOnce(buildUser())
        .mockResolvedValueOnce(buildUser({ isActive: false }));

      await service.update({ id: 1, isActive: false });

      expect(mockUpdateQb.set).toHaveBeenCalledWith({ isActive: false });
      expect(mockRepositories.email.findOne).not.toHaveBeenCalled();
      expect(mockRepositories.email.update).not.toHaveBeenCalled();
    });

    // Email/username changes are now owned exclusively by
    // ContactsService.syncUserEmailFromContact (see contacts.service.ts),
    // so this endpoint must never write them, even if a stale caller still
    // sends an `email` field.
    it('ignores an email field if one is still sent by a caller', async () => {
      mockRepositories.user.findOne
        .mockResolvedValueOnce(buildUser())
        .mockResolvedValueOnce(buildUser());

      await service.update({ id: 1, email: 'new@example.com' } as any);

      expect(mockRepositories.user.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockUpdateQb.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ email: expect.anything() }),
      );
      expect(mockRepositories.email.update).not.toHaveBeenCalled();
    });
  });
});
