import { HttpModule, Module } from '@nestjs/common';
import { EventsController } from '../events/controllers/events.controller';
import { EventsService } from './events.service';
import { VendorModule } from '../vendor/vendor.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsCategoriesController } from '../events/controllers/event-categories.controller';
import { EventsFieldsController } from '../events/controllers/event-fields.controller';
import { EventsAttendanceController } from './controllers/event-attendance.controller';
import { PrismaService } from '../shared/prisma.service';
import { EventsMetricsController } from '../events/controllers/event-metrics.controller';
import { appEntities } from '../config';

import { EventActivitiesController } from './controllers/event-activities.controller';
import { EventActivitiesService } from './event-activities.service';
import { MemberEventActivitiesService } from './member-event-activities.service';
import { MemberEventActivitiesController } from './controllers/member-event-activities.controller';

import { EventsRegistrationController } from './event-registration.controller';
import { EventRegistrationService } from './event-registration.service';


@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  controllers: [
    EventsController,
    EventsCategoriesController,
    EventsFieldsController,
    EventsAttendanceController,
    EventsMetricsController,

    EventActivitiesController,
    MemberEventActivitiesController
    
  ],
  providers: [EventsService, PrismaService,EventActivitiesService,MemberEventActivitiesService ],

    EventsRegistrationController,
  ],
  providers: [EventsService, PrismaService, EventRegistrationService],

  exports: [EventsService],
})
export class EventsModule {}
