import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolunteeringService } from '../volunteering.service';
import Person from '../../crm/entities/person.entity';

@ApiTags('Services Volunteering')
@Controller('api/services/volunteering')
export class VolunteeringController {
  constructor(
    private readonly volunteeringService: VolunteeringService,
  ) {
  }

  @Get('persons')
  index(): Promise<Person[]> {
    return this.volunteeringService.findAll();
  }

  @Get('ministries')
  async findAllMinistries() {
    return await this.volunteeringService.findAllMinistries();
  }
}
