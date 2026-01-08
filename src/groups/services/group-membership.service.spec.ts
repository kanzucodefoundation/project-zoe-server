import { Test, TestingModule } from '@nestjs/testing';
import { GroupsMembershipService } from './group-membership.service';
import { Connection, Repository, TreeRepository } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import Group from '../entities/group.entity';

describe('GroupsMembershipService', () => {
  let service: GroupsMembershipService;
  let mockConnection: Partial<Connection>;

  beforeEach(async () => {
    // Create mock repositories
    const mockMembershipRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockGroupTreeRepository = {
      findOneOrFail: jest.fn(),
      findDescendants: jest.fn(),
      findAncestors: jest.fn(),
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === GroupMembership) return mockMembershipRepository;
        return mockMembershipRepository;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockGroupTreeRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsMembershipService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
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
  });
});
