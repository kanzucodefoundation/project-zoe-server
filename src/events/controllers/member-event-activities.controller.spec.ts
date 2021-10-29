<<<<<<< HEAD
// import { EventsMembershipService } from '../member-event-activities.service';
 import { Test, TestingModule } from '@nestjs/testing';
import { MemberEventActivitiesService } from '../member-event-activities.service';
// import { EventsMembershipController } from './member-event-activities.controller';

import { MemberEventActivitiesController } from "./member-event-activities.controller";


describe('MembershipController', () => {
  let controller: MemberEventActivitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberEventActivitiesController],
      providers: [MemberEventActivitiesService],
    }).compile();

    controller = module.get<MemberEventActivitiesController>(MemberEventActivitiesController);
=======
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
>>>>>>> 162f7daad108cae1c3289fa04cc0a5316a24f6f3
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
