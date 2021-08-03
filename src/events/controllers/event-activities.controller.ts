import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { EventActivitiesService } from '../event-activities.service';
import { CreateEventActivityDto } from '../dto/create-event-activity.dto';
import { UpdateEventActivityDto } from '../dto/update-event-activity.dto';
import { ApiTags } from '@nestjs/swagger';
import { EventActivity } from '../entities/event-activity.entity';


@ApiTags('Event-activities')
@Controller('event-activities')
export class EventActivitiesController {


  constructor(private readonly eventActivitiesService: EventActivitiesService){}

  @Post()
   async create(@Body() createEventActivityDto: CreateEventActivityDto){
    const eventActivity = await this.eventActivitiesService.create(createEventActivityDto);
  
    return  EventActivity;
  }

  @Get()
  findAll() {
    return this.eventActivitiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventActivitiesService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateEventActivityDto: UpdateEventActivityDto) {
    return this.eventActivitiesService.update(+id, updateEventActivityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventActivitiesService.remove(+id);
  }
}
