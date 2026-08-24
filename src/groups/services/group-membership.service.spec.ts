import { Test, TestingModule } from '@nestjs/testing';
import { GroupsMembershipService } from './group-membership.service';
import { Connection } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import Group from '../entities/group.entity';
import Contact from '../../crm/entities/contact.entity';
import { AppLogger } from '../../utils/app-logger.service';
import { GroupRole } from '../enums/groupRole';
import { BadRequestException } from '@nestjs/common';
import { TenantContext } from 'src/shared/tenant/tenant-context';

describe('GroupsMembershipService', () => {
  let service: GroupsMembershipService;
  let mockConnection: Partial<Connection>;
  let mockMembershipRepository: any;
  let mockGroupRepository: any;
  let mockContactRepository: any;
  let mockAppLogger: any;
  let mockContextLogger: any;
  let mockQb: any;
  let mockTenantContext: any;
  const TENANT_ID = 1;
  beforeEach(async () => {
    mockQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
    };

    mockMembershipRepository = {
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
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
      findOne: jest.fn().mockResolvedValue({ id: 9, parentId: null }),
      find: jest.fn().mockResolvedValue([]),
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
    mockContactRepository = {
      // Default: pretend every requested contact id belongs to the
      // current tenant, so tests unrelated to tenant-scoping don't have
      // to know about this repository. `In(ids)` produces a FindOperator
      // whose `.value` is the original id array.
      find: jest.fn().mockImplementation((options: any) => {
        // Handle both direct arrays and FindOperator objects
        let ids: number[] = [];
        if (options?.where?.id) {
          if (Array.isArray(options.where.id)) {
            ids = options.where.id;
          } else if (options.where.id && typeof options.where.id === 'object' && 'value' in options.where.id) {
            ids = options.where.id.value;
          }
        } else if (options?.where?.id?.value) {
          ids = options.where.id.value;
        }
        return Promise.resolve(ids.map((id) => ({ id })));
      }),
    };

    mockConnection = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Group) return mockGroupRepository;
        if (entity === Contact) return mockContactRepository;
        return mockMembershipRepository;
      }),
      getTreeRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Group) return mockGroupRepository;
        return mockMembershipRepository;
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

    mockTenantContext = {
      requireTenant: jest.fn().mockReturnValue(TENANT_ID),
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
        {
          provide: TenantContext,
          useValue: mockTenantContext,
        }
      ],
    }).compile();

    service = module.get<GroupsMembershipService>(GroupsMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize repositories', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
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
  
  it('should reject creating memberships for a group belonging to a different tenant', async () => {
    mockGroupRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({ groupId: 9, members: [51], role: GroupRole.Member }),
    ).rejects.toThrow(BadRequestException);

    // Verify tenant-scoped query was made
    expect(mockGroupRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 9,
          tenant: { id: TENANT_ID },
        }),
      }),
    );
  });

  it('should reject adding a contact that does not belong to the current tenant', async () => {
    // No contacts come back for this tenant, even though the group is valid.
    mockContactRepository.find.mockResolvedValue([]);

    await expect(
      service.create({ groupId: 9, members: [51], role: GroupRole.Member }),
    ).rejects.toThrow(BadRequestException);

    // Verify tenant-scoped query was made
    expect(mockContactRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          // Check for FindOperator with 'in' type and correct value
          id: expect.objectContaining({
            type: 'in',
            value: [51],
          }),
          tenant: { id: TENANT_ID },
        }),
      }),
    );
  });

  it('should list memberships by contactId', async () => {
    const membership = {
      id: 201,
      groupId: 9,
      contactId: 51,
      role: GroupRole.Member,
      joinedAt: new Date('2024-01-02T00:00:00.000Z'),
      leftAt: null,
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
    };
    mockMembershipRepository.findAndCount.mockResolvedValue([[membership], 7]);

    const memberships = await service.findAll({ contactId: 51 });

    expect(mockMembershipRepository.findAndCount).toHaveBeenCalledWith({
      relations: ['contact', 'contact.person', 'group', 'group.category'],
      where: { contactId: 51, isActive: true },
      order: { id: 'ASC' },
      skip: 0,
      take: 100,
    });
    expect(memberships).toEqual({
      data: [
        expect.objectContaining({
          id: 201,
          groupId: 9,
          contactId: 51,
          contact: { id: 51, name: 'Jane Doe' },
          group: { id: 9, name: 'Parent Group' },
          category: { id: 1, name: 'Location' },
          isInferred: true,
          isActive: true,
        }),
      ],
      total: 7,
    });
  });

  // Fix 2: Refactored assertions to follow our non-crashing manual sub-group lookup flow
  it('should list memberships for a group and its descendants', async () => {
    const parentGroup = { id: 9, name: 'Parent Group' };
    mockGroupRepository.findOneOrFail.mockResolvedValue(parentGroup);

    // Simulate finding direct children manually via .find()
    mockGroupRepository.find.mockResolvedValue([{ id: 10 }]);

    mockQb.getRawMany.mockResolvedValue([{ contactId: 51 }, { contactId: 52 }]);
    mockQb.getRawOne.mockResolvedValue({ count: '2' });
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

    expect(mockGroupRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 9 }),
      }),
    );

    expect(mockGroupRepository.find).toHaveBeenCalledWith({
      where: { parentId: 9 },
      select: ['id'],
    });

    expect(mockGroupRepository.find).toHaveBeenCalledWith({
      where: { parentId: 10 },
      select: ['id'],
    });
    expect(mockQb.orderBy).toHaveBeenCalledWith('m.contactId', 'ASC');
    expect(memberships.total).toBe(2);
    expect(memberships.data).toEqual([
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
