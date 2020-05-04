import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeamleadService } from '../teamlead.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Teamlead } from '../entities/teamlead.entity';



@ApiTags('Services Teamlead')
@Controller('api/services/teamlead')
export class TeamleadController {
  constructor(
    private readonly teamleadService: TeamleadService,
    
  ) {
  }


  @Get()
  index(): Promise<Teamlead[]> {
    return this.teamleadService.findAll();
  }

  @Post()
  async create(@Body() data: Teamlead): Promise<Teamlead> {
    return this.teamleadService.create(data);
  }
}
