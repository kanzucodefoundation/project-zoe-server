import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teamleadcalendar } from './entities/teamleadcalendar.entity';

@Injectable()
export class TeamleadcalendarService {
  constructor(
    @InjectRepository(Teamleadcalendar)
    private readonly teamleadcalendarRepository: Repository<Teamleadcalendar>,
  ) {
  }

  async findAll(): Promise<Teamleadcalendar[]> {
    return await this.teamleadcalendarRepository.find();
  }

  async create(data: Teamleadcalendar): Promise<Teamleadcalendar> {
    return await this.teamleadcalendarRepository.save(data);
  }
}
