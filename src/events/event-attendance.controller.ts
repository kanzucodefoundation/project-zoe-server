import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import EventAttendance from './entities/eventAttendance.entity';

@UseGuards(JwtAuthGuard)
@ApiTags('Events Attendance')
@Controller('api/events/attendance')
export class EventsAttendanceController {
  constructor(
    @InjectRepository(EventAttendance)
    private readonly repository: Repository<EventAttendance>,
  ) {}

  @Get()
  async findAll(): Promise<EventAttendance[]> {
    return await this.repository.find({});
  }

  @Post()
  async create(@Body() data: EventAttendance[]): Promise<EventAttendance[]> {
    return this.repository.save(data);
  }

  @Put()
  async update(
    @Body() { id, ...data }: EventAttendance,
  ): Promise<EventAttendance> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  @Get(':id')
  async findOne(@Param('id') id: any): Promise<EventAttendance> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: any): Promise<void> {
    await this.repository.delete(id);
  }
}
