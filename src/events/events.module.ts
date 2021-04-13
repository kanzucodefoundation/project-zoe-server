import { HttpModule, Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { VendorModule } from '../vendor/vendor.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { groupEntities } from '../groups/groups.helpers';
import { crmEntities } from '../crm/crm.helpers';
import { usersEntities } from '../users/users.helpers';
import { eventEntities } from './events.helpers';
import { EventsCategoriesController } from './event-categories.controller';
import { EventsFieldsController } from './event-fields.controller';
import { EventsAttendanceController } from './event-attendance.controller';
import { PrismaService } from '../shared/prisma.service';
import { EventCategoryService } from './event-category.service';

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([
      ...usersEntities,
      ...crmEntities,
      ...groupEntities,
      ...eventEntities,
    ]),
  ],
  controllers: [
    EventsController,
    EventsCategoriesController,
    EventsFieldsController,
    EventsAttendanceController,
  ],
  providers: [EventsService, PrismaService, EventCategoryService],
})
export class EventsModule {}
