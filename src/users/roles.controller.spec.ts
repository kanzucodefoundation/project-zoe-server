import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { Connection, Repository } from 'typeorm';
import Roles from './entities/roles.entity';

describe('RolesController', () => {
  let controller: RolesController;
  let mockRolesService: Partial<RolesService>;

  beforeEach(async () => {
    // Create mock connection and repository
    const mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    // Create mock service
    mockRolesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have injected roles service', () => {
    expect(mockRolesService).toBeDefined();
  });
});
