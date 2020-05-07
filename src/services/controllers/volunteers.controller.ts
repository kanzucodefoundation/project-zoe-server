import { Body, Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolunteersService } from '../volunteers.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Volunteer } from '../entities/volunteer.entity';


@ApiTags('Services Volunteers')
@Controller('api/services/volunteers')
export class VolunteersController {
  constructor(
    private readonly volunteersService: VolunteersService,
    // @InjectRepository(Volunteer)
    // private readonly volunteerRepository: Repository<Volunteer>,
  ) {
  }

  @Get()
  index(): Promise<Volunteer[]> {
    return this.volunteersService.findAll();
  }

  @Post()
  async create(@Body() data: Volunteer): Promise<Volunteer> {
    return this.volunteersService.create(data);
  }

  // @Put(':id/update')
  @Patch(':id')
    async update(@Param('id') id, @Body() data: Volunteer): Promise<any> {
        data.id = Number(id);
        console.log('Update #' + data.id)
        return this.volunteersService.update(data);
    }
}
