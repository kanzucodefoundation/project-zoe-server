import { Test, TestingModule } from '@nestjs/testing';
import { EventActivitiesService } from './event-activities.service';

describe('EventActivitiesService', () => {
  let service: EventActivitiesService;

  beforeEach(async () => {
    const mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventActivitiesService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<EventActivitiesService>(EventActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
