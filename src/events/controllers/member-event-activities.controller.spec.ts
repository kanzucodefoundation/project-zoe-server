import { EventsMembershipService } from '../member-event-activities.service';
import { Test, TestingModule } from '@nestjs/testing';
import { EventsMembershipController } from './member-event-activities.controller';


describe('MembershipController', () => {
  let controller: EventsMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsMembershipController],
      providers: [EventsMembershipService],
    }).compile();

    controller = module.get<EventsMembershipController>(EventsMembershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
