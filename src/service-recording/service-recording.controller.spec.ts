import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ServiceRecordingController } from './service-recording.controller';
import { ServiceRecordingService } from './service-recording.service';
import { UsersService } from '../users/users.service';

describe('ServiceRecordingController', () => {
  let controller: ServiceRecordingController;

  const mockSummary = {
    total: 1,
    created: 1,
    linked: 0,
    errors: [],
  };

  const mockService = {
    bulkUploadGuests: jest.fn().mockResolvedValue(mockSummary),
    bulkUploadBelievers: jest.fn().mockResolvedValue(mockSummary),
    bulkUploadRedZone: jest.fn().mockResolvedValue(mockSummary),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRecordingController],
      providers: [
        {
          provide: ServiceRecordingService,
          useValue: mockService,
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ServiceRecordingController>(
      ServiceRecordingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should upload red zone rows through the service', async () => {
    const file = {
      originalname: 'red-zone.csv',
      buffer: Buffer.from('First Name,Last Name,Phone\nJane,Doe,0700000000'),
    } as Express.Multer.File;
    const req = {
      tenantId: 12,
      user: { id: 34 },
    };

    const result = await controller.bulkUploadRedZone(file, req);

    expect(mockService.bulkUploadRedZone).toHaveBeenCalledWith(12, 34, file);
    expect(result).toEqual(mockSummary);
  });
});
