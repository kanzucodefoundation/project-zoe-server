import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolunteersService } from '../volunteers.service';
import Person from '../../crm/entities/person.entity';


@ApiTags('Services Volunteers')
@Controller('api/services/volunteers')
export class VolunteersController {
  constructor(
    private readonly volunteersService: VolunteersService,
  ) {
  }

  @Get()
  index(): Promise<Person[]> {
    return this.volunteersService.findAll();
  }
}
