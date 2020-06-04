import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointments} from './entities/appointments.entity';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointments)
    private readonly appointmentsRepository: Repository<Appointments>,
  ) {
  }

  async findAll(): Promise<Appointments[]> {
    return await this.appointmentsRepository.find();
  }

  async create(data: Appointments): Promise<Appointments> {
    return await this.appointmentsRepository.save(data);
  }
}
