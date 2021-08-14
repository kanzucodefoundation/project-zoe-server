import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { EventActivitiesService } from '../event-activities.service';
import { CreateEventActivityDto } from '../dto/create-event-activity.dto';
import { ApiTags } from '@nestjs/swagger';
import { EventActivity } from '../entities/event-activity.entity';
import SearchDto from 'src/shared/dto/search.dto';


@ApiTags('EventActivities')
@Controller('api/events/activities')
export class EventActivitiesController {
 constructor(private service: EventActivitiesService){}


  @Get()
  async findAll(@Query()req:SearchDto):Promise<EventActivity[]> {
    return await this.service.findAll(req);
  }
  @Post()
  async create( @Body() data:EventActivity): Promise<CreateEventActivityDto |any>{
    return await this.service.create(data);
  }

  

  @Get('/:id')
  async findOne(@Param('id') id: number) {
    return await this.service.findOne(id);
  }

  @Put()
  async update (@Body() data: EventActivity):Promise<CreateEventActivityDto | any> {
    return await this.service.update(data)
  }

  @Delete(':id')
  async remove(@Param('id') id:number):Promise<void> {
    return await this.service.remove(id);
  }
}
