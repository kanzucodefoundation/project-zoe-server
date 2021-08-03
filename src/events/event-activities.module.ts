import { Module } from '@nestjs/common';
import { EventActivitiesService } from './event-activities.service';
import { EventActivitiesController } from './controllers/event-activities.controller';

@Module({
  controllers: [EventActivitiesController],
  providers: [EventActivitiesService]
})
export class EventActivitiesModule {}
