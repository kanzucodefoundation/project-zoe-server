import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { Volunteer } from './entities/volunteer.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteerRepository: Repository<Volunteer>,
  ) {
  }

  async findAll(): Promise<Volunteer[]> {
    return await this.volunteerRepository.find();
  }

  async create(data: Volunteer): Promise<Volunteer> {
    return await this.volunteerRepository.save(data);
  }

  async update(data: Volunteer): Promise<UpdateResult> {
      return await this.volunteerRepository.update(data.id, data);
  }
}
