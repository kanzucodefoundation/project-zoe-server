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
import EventField from './entities/eventField.entity';

@UseGuards(JwtAuthGuard)
@ApiTags('Events Fields')
@Controller('api/events/fields')
export class EventsFieldsController {
  constructor(
    @InjectRepository(EventField)
    private readonly repository: Repository<EventField>,
  ) {}

  @Get()
  async findAll(): Promise<EventField[]> {
    return await this.repository.find({});
  }

  @Post()
  async create(@Body() data: EventField): Promise<EventField> {
    return this.repository.save(data);
  }

  @Put()
  async update(@Body() { id, ...data }: EventField): Promise<EventField> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  @Get(':id')
  async findOne(@Param('id') id: any): Promise<EventField> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: any): Promise<void> {
    await this.repository.delete(id);
  }
}
