import { Test, TestingModule } from '@nestjs/testing';
import { GroupsMembershipService } from './group-membership.service';
import { Connection } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import Group from '../entities/group.entity';
import { AppLogger } from '../../utils/app-logger.service';
import { GroupRole } from '../enums/groupRole';
import { BadRequestException } from '@nestjs/common';

describe('GroupsMembershipService', () => {
  let service: GroupsMembershipService;
  let mockConnection: Partial<Connection>;
  let mockMembershipRepository: any;
  let mockGroupRepository: any;
  let mockAppLogger: any;
  let mockContextLogger: any;
  let mockQb: any;
  let mockFindDescendants: jest.Mock;

  beforeEach(async () => {
    mockFindDescendants = jest.fn().mockResolvedValue([]);

    mockQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    mockMembershipRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((memberships) =>
        Promise.resolve(
          memberships.map((membership, index) => ({
            id: 101 + index,
            ...membership,
          })),
        ),
      ),
      create: jest.fn((membership) => membership),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    mockGroupRepository = {
      findOneOrFail: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      metadata: {
        tableName: 'group',
        schema: null,
        closureJunctionTable: {
          schema: null,
          tableName: 'group_closure',
          ancestorColumns: [{ databaseName: 'id_ancestor' }],
          descendantColumns: [{ databaseName: 'id_descendant' }],
        },
      },
    };

    mockConnection = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Group) return mockGroupRepository;
        return mockMembershipRepository;
      }),
      getTreeRepository: jest.fn().mockReturnValue({
        ...mockGroupRepository,
        findDescendants: mockFindDescendants,
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
      }),
    };

    mockContextLogger = {
      business: jest.fn(),
    };

    mockAppLogger = {
      createContextLogger: jest.fn().mockReturnValue(mockContextLogger),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsMembershipService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: AppLogger,
          useValue: mockAppLogger,
        },
      ],
    }).compile();

    service = module.get<GroupsMembershipService>(GroupsMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize repositories', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
    expect(mockConnection.getTreeRepository).toHaveBeenCalledWith(Group);
    expect(mockAppLogger.createContextLogger).toHaveBeenCalledWith(
      'GroupsMembershipService',
    );
  });

  it('should insert every member in a bulk membership request', async () => {
    const inserted = await service.create({
      groupId: 9,
      members: [51, 7],
      role: GroupRole.Member,
    });

    expect(inserted).toBe(2);
    expect(mockMembershipRepository.create).toHaveBeenCalledTimes(2);
    expect(mockMembershipRepository.save).toHaveBeenCalledWith([
      {
        groupId: 9,
        contactId: 51,
        role: GroupRole.Member,
        isActive: true,
      },
      {
        groupId: 9,
        contactId: 7,
        role: GroupRole.Member,
        isActive: true,
      },
    ]);
    expect(mockContextLogger.business).toHaveBeenCalledWith(
      'log',
      'Group memberships upserted',
      expect.objectContaining({
        resource: 'group_membership',
        resourceId: 9,
        metadata: expect.objectContaining({
          created: 2,
          reactivated: 0,
          contactIds: [51, 7],
          role: GroupRole.Member,
        }),
      }),
    );
  });

  it('should reject adding a contact who is an active leader as a member', async () => {
    mockMembershipRepository.find.mockResolvedValue([
      {
        id: 55,
        groupId: 9,
        contactId: 51,
        role: GroupRole.Leader,
        isActive: true,
      },
    ]);

    await expect(
      service.create({ groupId: 9, members: [51], role: GroupRole.Member }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow re-adding a contact as a leader even if they were a leader before', async () => {
    mockMembershipRepository.find.mockResolvedValue([
      {
        id: 55,
        groupId: 9,
        contactId: 51,
        role: GroupRole.Leader,
        isActive: false,
        leftAt: new Date(),
      },
    ]);

    const inserted = await service.create({
      groupId: 9,
      members: [51],
      role: GroupRole.Leader,
    });

    expect(inserted).toBe(1);
  });

  it('should list memberships for a group and its descendants', async () => {
    const parentGroup = { id: 9, name: 'Parent Group' };
    mockGroupRepository.findOneOrFail.mockResolvedValue(parentGroup);
    mockFindDescendants.mockResolvedValue([{ id: 10, name: 'Child Group' }]);
    mockQb.getRawMany.mockResolvedValue([{ contactId: 51 }, { contactId: 52 }]);
    mockMembershipRepository.find.mockResolvedValue([
      {
        id: 101,
        groupId: 9,
        contactId: 51,
        role: GroupRole.Member,
        isActive: true,
        contact: {
          id: 51,
          person: { firstName: 'Jane', lastName: 'Doe' },
        },
        group: {
          id: 9,
          name: 'Parent Group',
          category: { id: 1, name: 'Location' },
        },
      },
      {
        id: 102,
        groupId: 10,
        contactId: 52,
        role: GroupRole.Leader,
        isActive: true,
        contact: {
          id: 52,
          person: { firstName: 'John', lastName: 'Doe' },
        },
        group: {
          id: 10,
          name: 'Child Group',
          category: { id: 2, name: 'Cell' },
        },
      },
    ]);

    const memberships = await service.findAll({ groupId: 9 });

    expect(mockGroupRepository.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 9 },
    });
    expect(mockFindDescendants).toHaveBeenCalledWith(parentGroup);
    expect(memberships).toEqual([
      expect.objectContaining({
        id: 101,
        groupId: 9,
        contact: { id: 51, name: 'Jane Doe' },
        group: { id: 9, name: 'Parent Group' },
        isInferred: false,
      }),
      expect.objectContaining({
        id: 102,
        groupId: 10,
        contact: { id: 52, name: 'John Doe' },
        group: { id: 10, name: 'Child Group' },
        isInferred: true,
      }),
    ]);
  });
});
