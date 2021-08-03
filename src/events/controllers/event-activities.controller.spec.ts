import { Test, TestingModule } from '@nestjs/testing';
import { EventActivitiesController } from './event-activities.controller';
import { EventActivitiesService } from '../../event-activities/event-activities.service';

describe('EventActivitiesController', () => {
  let controller: EventActivitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventActivitiesController],
      providers: [EventActivitiesService],
    }).compile();

    controller = module.get<EventActivitiesController>(EventActivitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
