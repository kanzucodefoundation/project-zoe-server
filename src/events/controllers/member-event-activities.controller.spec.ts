// import { EventsMembershipService } from '../member-event-activities.service';
import { Test, TestingModule } from '@nestjs/testing';
import { MemberEventActivitiesService } from '../member-event-activities.service';
// import { EventsMembershipController } from './member-event-activities.controller';

import { MemberEventActivitiesController } from './member-event-activities.controller';

describe('MembershipController', () => {
  let controller: MemberEventActivitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberEventActivitiesController],
      providers: [MemberEventActivitiesService],
    }).compile();

    controller = module.get<MemberEventActivitiesController>(
      MemberEventActivitiesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
