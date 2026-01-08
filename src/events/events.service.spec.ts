import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { GoogleService } from '../vendor/google.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    const mockGoogleService = {
      getPlaceDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
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

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
