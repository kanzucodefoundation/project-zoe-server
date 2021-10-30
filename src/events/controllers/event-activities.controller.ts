import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { EventActivitiesService } from '../event-activities.service';
import { CreateEventActivityDto } from '../dto/create-event-activity.dto';
import { ApiTags } from '@nestjs/swagger';
import { EventActivity } from '../entities/event-activity.entity';

import EventActivitiesDto from '../dto/event-activities-search.dto';
import EventActivitiesSearchDto from '../dto/event-activities-search.dto';

@ApiTags('EventActivities')
@Controller('api/events/activities')
export class EventActivitiesController {
  constructor(private service: EventActivitiesService) {}

  @Get()
  async findAll(
    
  ): Promise<CreateEventActivityDto[]> {
    return await this.service.findAll();
  }

  @Post()
  async create(
    @Body() data: EventActivity,
  ): Promise<CreateEventActivityDto | any> {
    return await this.service.create(data);
  }

  @Get('/:id')
  async findOne(@Param('id') id: number) {
    return await this.service.findOne(id);
  }

  @Put()
  async update(
    @Body() data: EventActivity,
  ): Promise<CreateEventActivityDto | any> {
    return await this.service.update(data);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return await this.service.remove(id);
  }
}
