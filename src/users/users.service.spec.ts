import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ContactsService } from '../crm/contacts.service';
import { JwtHelperService } from '../auth/jwt-helpers.service';
import { Connection, Repository } from 'typeorm';
import Email from '../crm/entities/email.entity';
import Roles from './entities/roles.entity';
import UserRoles from './entities/userRoles.entity';
import Person from '../crm/entities/person.entity';

describe('UsersService', () => {
  let service: UsersService;
  let mockConnection: Partial<Connection>;
  let mockContactsService: Partial<ContactsService>;
  let mockJwtHelperService: Partial<JwtHelperService>;
  let mockRepositories: any;

  beforeEach(async () => {
    // Create mock repositories
    mockRepositories = {
      user: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      email: {
        find: jest.fn(),
        save: jest.fn(),
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
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === User) return mockRepositories.user;
        if (entity === Email) return mockRepositories.email;
        if (entity === Roles) return mockRepositories.roles;
        if (entity === UserRoles) return mockRepositories.userRoles;
        if (entity === Person) return mockRepositories.person;
        return mockRepositories.user;
      }),
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
});
