import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DayService } from '../day.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Day } from '../entities/day.entity';



@ApiTags('Appointment Day')
@Controller('api/appointment/day')
export class DayController {
  constructor(
    private readonly dayService: DayService,
    
  ) {
  }


  @Get()
  index(): Promise<Day[]> {
    return this.dayService.findAll();
  }

  @Post()
  async create(@Body() data: Day): Promise<Day> {
    return this.dayService.create(data);
  }
}
