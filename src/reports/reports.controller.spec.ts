import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AppLogger } from '../utils/app-logger.service';
import { UsersService } from '../users/users.service';
import { Reflector } from '@nestjs/core';

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const mockReportsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockAppLogger = {
      apiLog: jest.fn(),
      businessLog: jest.fn(),
      performanceLog: jest.fn(),
    };

    const mockUsersService = {
      findOne: jest.fn(),
      findByName: jest.fn(),
    };

    const mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
        {
          provide: AppLogger,
          useValue: mockAppLogger,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
