import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Day } from './entities/day.entity';

@Injectable()
export class DayService {
  constructor(
    @InjectRepository(Day)
    private readonly dayRepository: Repository<Day>,
  ) {
  }

  async findAll(): Promise<Day[]> {
    return await this.dayRepository.find();
  }

  async create(data: Day): Promise<Day> {
    return await this.dayRepository.save(data);
  }
}
