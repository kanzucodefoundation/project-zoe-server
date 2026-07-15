import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { GoogleService } from '../vendor/google.service';
import { GroupFinderService } from './group-finder/group-finder.service';
import { AddressesService } from './addresses.service';
import { GroupTreeService } from '../groups/services/group-tree.service';
import { AppLogger } from '../utils/app-logger.service';
import { GroupsMembershipService } from '../groups/services/group-membership.service';
import { TenantContext } from '../shared/tenant/tenant-context';
import { Connection, Repository, TreeRepository } from 'typeorm';
import Contact from './entities/contact.entity';
import Person from './entities/person.entity';
import Company from './entities/company.entity';
import Phone from './entities/phone.entity';
import Email from './entities/email.entity';
import Address from './entities/address.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';
import GroupMembershipRequest from '../groups/entities/groupMembershipRequest.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { GroupRole } from '../groups/enums/groupRole';

describe('ContactsService', () => {
  let service: ContactsService;
  let mockConnection: Partial<Connection>;
  let mockRepositories: any;

  beforeEach(async () => {
    // Create mock repositories
    mockRepositories = {
      contact: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      person: {
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
      company: { save: jest.fn() },
      phone: { save: jest.fn() },
      email: { save: jest.fn() },
      address: { save: jest.fn() },
      membership: {
        find: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      groupTree: { findDescendants: jest.fn() },
      gmRequest: { save: jest.fn() },
      tenant: { findOne: jest.fn() },
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Contact) return mockRepositories.contact;
        if (entity === Person) return mockRepositories.person;
        if (entity === Company) return mockRepositories.company;
        if (entity === Phone) return mockRepositories.phone;
        if (entity === Email) return mockRepositories.email;
        if (entity === Address) return mockRepositories.address;
        if (entity === GroupMembership) return mockRepositories.membership;
        if (entity === GroupMembershipRequest)
          return mockRepositories.gmRequest;
        if (entity === Tenant) return mockRepositories.tenant;
        return mockRepositories.contact;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockRepositories.groupTree),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: GoogleService,
          useValue: { searchPlaces: jest.fn() },
        },
        {
          provide: GroupFinderService,
          useValue: { findClosest: jest.fn() },
        },
        {
          provide: AddressesService,
          useValue: { create: jest.fn() },
        },
        {
          provide: GroupTreeService,
          useValue: { findDescendants: jest.fn() },
        },
        {
          provide: AppLogger,
          useValue: {
            createContextLogger: jest.fn().mockReturnValue({
              startTracking: jest.fn().mockReturnValue('tracking-id'),
              endTracking: jest.fn(),
              business: jest.fn(),
              dataAccess: jest.fn(),
              security: jest.fn(),
              error: jest.fn(),
            }),
          },
        },
        {
          provide: GroupsMembershipService,
          useValue: { create: jest.fn().mockResolvedValue(1) },
        },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize repositories correctly', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Contact);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Person);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Company);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Phone);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Email);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Address);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(
      GroupMembershipRequest,
    );
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Tenant);
    expect(mockConnection.getTreeRepository).toHaveBeenCalledWith(Group);
  });

  describe('handleGroupMembershipsUpdate', () => {
    let qbMock: any;
    let groupsMembershipServiceMock: { create: jest.Mock };

    beforeEach(() => {
      qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockRepositories.membership.createQueryBuilder.mockReturnValue(qbMock);

      groupsMembershipServiceMock = { create: jest.fn().mockResolvedValue(1) };
      (service as any).groupsMembershipService = groupsMembershipServiceMock;
    });

    const buildContact = (groupMemberships: any[]) =>
      ({ id: 1, groupMemberships }) as any;

    const invoke = (contact: any, newGroups: any[]) =>
      (service as any).handleGroupMembershipsUpdate(contact, newGroups);

    it('leaves an existing LEADER membership untouched when the caller omits its role', async () => {
      const contact = buildContact([
        { id: 10, groupId: 100, role: GroupRole.Leader, isActive: true },
        { id: 11, groupId: 200, role: GroupRole.Member, isActive: true },
      ]);

      // Patching e.g. firstName re-sends the current groups without roles
      await invoke(contact, [{ id: 100 }, { id: 200 }]);

      expect(qbMock.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ role: expect.anything() }),
      );
      expect(groupsMembershipServiceMock.create).not.toHaveBeenCalled();
    });

    it('updates the role when the caller explicitly sends a different role', async () => {
      const contact = buildContact([
        { id: 10, groupId: 100, role: GroupRole.Leader, isActive: true },
      ]);

      await invoke(contact, [{ id: 100, role: GroupRole.Member }]);

      expect(qbMock.set).toHaveBeenCalledWith({ role: GroupRole.Member });
      expect(qbMock.where).toHaveBeenCalledWith('id = :id', { id: 10 });
    });

    it('does nothing for a membership whose explicit role matches the current role', async () => {
      const contact = buildContact([
        { id: 10, groupId: 100, role: GroupRole.Leader, isActive: true },
      ]);

      await invoke(contact, [{ id: 100, role: GroupRole.Leader }]);

      expect(qbMock.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ role: expect.anything() }),
      );
    });

    it('defaults a brand new membership to Member when no role is given', async () => {
      const contact = buildContact([]);

      await invoke(contact, [{ id: 300 }]);

      expect(groupsMembershipServiceMock.create).toHaveBeenCalledWith({
        groupId: 300,
        members: [1],
        role: GroupRole.Member,
      });
    });

    it('creates a new membership with the explicitly requested role', async () => {
      const contact = buildContact([]);

      await invoke(contact, [{ id: 300, role: GroupRole.Leader }]);

      expect(groupsMembershipServiceMock.create).toHaveBeenCalledWith({
        groupId: 300,
        members: [1],
        role: GroupRole.Leader,
      });
    });

    it('deactivates memberships for groups no longer present in the new list', async () => {
      const contact = buildContact([
        { id: 10, groupId: 100, role: GroupRole.Leader, isActive: true },
        { id: 11, groupId: 200, role: GroupRole.Member, isActive: true },
      ]);

      await invoke(contact, [{ id: 100, role: GroupRole.Leader }]);

      expect(qbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(qbMock.where).toHaveBeenCalledWith('id = :id', { id: 11 });
    });

    it('throws when no groups are provided', async () => {
      const contact = buildContact([
        { id: 10, groupId: 100, role: GroupRole.Leader, isActive: true },
      ]);

      await expect(invoke(contact, [])).rejects.toThrow(
        'Contact must be assigned to at least one group',
      );
    });
  });
});
