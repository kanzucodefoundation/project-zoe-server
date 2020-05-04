import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teamlead } from './entities/teamlead.entity';

@Injectable()
export class TeamleadService {
  constructor(
    @InjectRepository(Teamlead)
    private readonly teamleadRepository: Repository<Teamlead>,
  ) {
  }

  async findAll(): Promise<Teamlead[]> {
    return await this.teamleadRepository.find();
  }

  async create(data: Teamlead): Promise<Teamlead> {
    return await this.teamleadRepository.save(data);
  }
}
