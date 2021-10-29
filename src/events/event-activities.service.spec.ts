import { Test, TestingModule } from '@nestjs/testing';
import { EventActivitiesService } from './event-activities.service';

describe('EventActivitiesService', () => {
  let service: EventActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventActivitiesService],
    }).compile();

    service = module.get<EventActivitiesService>(EventActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
