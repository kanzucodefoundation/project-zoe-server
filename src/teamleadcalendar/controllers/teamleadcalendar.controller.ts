import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeamleadcalendarService } from '../teamleadcalendar.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Teamleadcalendar } from '../entities/teamleadcalendar.entity';



@ApiTags('Services Teamleadcalendar')
@Controller('api/services/teamleadcalendar')
export class TeamleadcalendarController {
  constructor(
    private readonly teamleadcalendarService: TeamleadcalendarService,
    
  ) {
  }


  @Get()
  index(): Promise<Teamleadcalendar[]> {
    return this.teamleadcalendarService.findAll();
  }

  @Post()
  async create(@Body() data: Teamleadcalendar): Promise<Teamleadcalendar> {
    return this.teamleadcalendarService.create(data);
  }
}
