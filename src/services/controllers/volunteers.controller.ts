import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolunteersService } from '../volunteers.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Volunteer } from '../entities/volunteer.entity';
// import { Like, Repository } from 'typeorm';
// import { CreateVolunteerDto } from '../dto/create-volunteer.dto';
// import { hasValue } from '../../utils/basicHelpers';
// import { FindConditions } from 'typeorm/find-options/FindConditions';


@ApiTags('Services Volunteers')
@Controller('api/services/volunteers')
export class VolunteersController {
  constructor(
    private readonly volunteersService: VolunteersService,
    // @InjectRepository(Volunteer)
    // private readonly volunteerRepository: Repository<Volunteer>,
  ) {
  }

  // @Get()
  // async findAll(@Query() req: CreateVolunteerDto): Promise<Volunteer[]> {
  //   let q: FindConditions<Volunteer>[] = [];
  //   if (hasValue(req.query)) {
  //     q = [
  //       {
  //         firstName: Like(`${req.query}%`),
  //       },
  //       {
  //         surname: Like(`${req.query}%`),
  //       },
  //     ];
  //   }
  //   return await this.volunteerRepository.find({
  //     where: q,
  //     skip: req.skip,
  //     take: req.limit,
  //   });
  // }

  @Get()
  index(): Promise<Volunteer[]> {
    return this.volunteersService.findAll();
  }

  @Post()
  async create(@Body() data: Volunteer): Promise<Volunteer> {
    return this.volunteersService.create(data);
  }
}
