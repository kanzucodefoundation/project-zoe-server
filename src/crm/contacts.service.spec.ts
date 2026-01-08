import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { GoogleService } from '../vendor/google.service';
import { PrismaService } from '../shared/prisma.service';
import { GroupFinderService } from './group-finder/group-finder.service';
import { AddressesService } from './addresses.service';
import { GroupTreeService } from '../groups/services/group-tree.service';
import { AppLogger } from '../utils/app-logger.service';
import { GroupsMembershipService } from '../groups/services/group-membership.service';
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
      membership: { find: jest.fn(), save: jest.fn() },
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
        if (entity === GroupMembershipRequest) return mockRepositories.gmRequest;
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
          provide: PrismaService,
          useValue: { contact: { findMany: jest.fn() } },
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
              businessLog: jest.fn(),
              dataAccessLog: jest.fn(),
              error: jest.fn(),
            }),
          },
        },
        {
          provide: GroupsMembershipService,
          useValue: { addMember: jest.fn() },
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
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembershipRequest);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Tenant);
    expect(mockConnection.getTreeRepository).toHaveBeenCalledWith(Group);
  });
});
