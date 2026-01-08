import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';
import { GoogleService } from '../vendor/google.service';
import { Connection, Repository } from 'typeorm';
import Address from './entities/address.entity';

describe('AddressesService', () => {
  let service: AddressesService;
  let mockConnection: Partial<Connection>;
  let mockGoogleService: Partial<GoogleService>;

  beforeEach(async () => {
    // Create mock address repository
    const mockAddressRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockAddressRepository),
    };

    // Create mock Google service
    mockGoogleService = {
      getPlaceDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: GoogleService,
          useValue: mockGoogleService,
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize address repository', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Address);
  });
});
