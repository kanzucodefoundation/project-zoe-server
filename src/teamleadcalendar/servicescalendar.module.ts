import { Module } from '@nestjs/common';
import { TeamleadcalendarController } from './controllers/teamleadcalendar.controller';
import { TeamleadcalendarService } from './teamleadcalendar.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teamleadcalendar } from './entities/teamleadcalendar.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Teamleadcalendar])],
  providers: [TeamleadcalendarService],
  controllers: [
    TeamleadcalendarController,
  ],
  exports: [TeamleadcalendarService],
})
export class ServicescalendarModule {
}
