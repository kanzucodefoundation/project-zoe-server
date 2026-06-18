import { Test, TestingModule } from '@nestjs/testing';
import { GroupsMembershipService } from './group-membership.service';
import { Connection } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import Group from '../entities/group.entity';
import { AppLogger } from '../../utils/app-logger.service';
import { GroupRole } from '../enums/groupRole';

describe('GroupsMembershipService', () => {
  let service: GroupsMembershipService;
  let mockConnection: Partial<Connection>;
  let mockMembershipRepository: any;
  let mockGroupTreeRepository: any;
  let mockAppLogger: any;
  let mockContextLogger: any;

  beforeEach(async () => {
    // Create mock repositories
    mockMembershipRepository = {
      find: jest.fn(),
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
    };

    mockGroupTreeRepository = {
      findOneOrFail: jest.fn(),
      findDescendants: jest.fn(),
      findAncestors: jest.fn(),
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockMembershipRepository),
      getTreeRepository: jest.fn().mockReturnValue(mockGroupTreeRepository),
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
      'Group memberships created',
      expect.objectContaining({
        resource: 'group_membership',
        resourceId: 9,
        metadata: expect.objectContaining({
          memberCount: 2,
          contactIds: [51, 7],
          role: GroupRole.Member,
        }),
      }),
    );
  });

  it('should list memberships for a group and its descendants', async () => {
    const parentGroup = { id: 9, name: 'Parent Group' };
    mockGroupTreeRepository.findOneOrFail.mockResolvedValue(parentGroup);
    mockGroupTreeRepository.findDescendants.mockResolvedValue([
      parentGroup,
      { id: 10, name: 'Child Group' },
    ]);
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

    expect(mockGroupTreeRepository.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 9 },
    });
    expect(mockGroupTreeRepository.findDescendants).toHaveBeenCalledWith(
      parentGroup,
    );
    expect(mockMembershipRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: ['contact', 'contact.person', 'group', 'group.category'],
        skip: 0,
        take: 100,
        where: expect.objectContaining({
          groupId: expect.any(Object),
          isActive: true,
        }),
      }),
    );
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
