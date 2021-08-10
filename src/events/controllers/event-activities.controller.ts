import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { EventActivitiesService } from '../event-activities.service';
import { CreateEventActivityDto } from '../dto/create-event-activity.dto';
import { UpdateEventActivityDto } from '../dto/update-event-activity.dto';
import { ApiTags } from '@nestjs/swagger';
import { EventActivity } from '../entities/event-activity.entity';


@ApiTags('Event-Activities')
@Controller('api/events/activities')
export class EventActivitiesController {
 constructor(private eventActivitiesService: EventActivitiesService){}

  @Post()
   create(@Body() createEventActivityDto: CreateEventActivityDto){
    return this.eventActivitiesService.create(createEventActivityDto);
  }

  @Get()
  findAll() {
    return this.eventActivitiesService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: number) {
    return this.eventActivitiesService.findOne(id);
  }

  @Put()
  update (@Body() data: UpdateEventActivityDto):Promise<UpdateEventActivityDto> {
    return this.eventActivitiesService.update(data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventActivitiesService.remove(+id);
  }
}
