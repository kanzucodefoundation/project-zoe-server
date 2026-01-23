import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtHelperService } from './jwt-helpers.service';
import { JwtService } from '@nestjs/jwt';
import { AppLogger } from '../utils/app-logger.service';
import { Connection, Repository } from 'typeorm';
import Roles from '../users/entities/roles.entity';

describe('AuthService', () => {
  let service: AuthService;
  let mockConnection: Partial<Connection>;
  let mockUsersService: Partial<UsersService>;
  let mockJwtHelperService: Partial<JwtHelperService>;
  let mockJwtService: Partial<JwtService>;
  let mockAppLogger: Partial<AppLogger>;
  let mockRolesRepository: Partial<Repository<Roles>>;

  beforeEach(async () => {
    // Create mock repository
    mockRolesRepository = {
      find: jest.fn(),
      manager: {
        getRepository: jest.fn(),
      } as any,
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockRolesRepository),
    };

    // Create mock services
    mockUsersService = {
      findByName: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockJwtHelperService = {
      generateToken: jest.fn(),
      decodeToken: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn(),
      decode: jest.fn(),
    };

    mockAppLogger = {
      createContextLogger: jest.fn().mockReturnValue({
        startTracking: jest.fn().mockReturnValue('tracking-id'),
        endTracking: jest.fn(),
        auth: jest.fn(),
        security: jest.fn(),
        error: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtHelperService,
          useValue: mockJwtHelperService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AppLogger,
          useValue: mockAppLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create context logger on initialization', () => {
    expect(mockAppLogger.createContextLogger).toHaveBeenCalledWith(
      'AuthService',
    );
  });

  it('should get repository from connection', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Roles);
  });
});
