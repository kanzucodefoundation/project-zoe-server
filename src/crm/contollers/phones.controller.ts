import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import Phone from '../entities/phone.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';

@ApiTags('Crm Phones')
@Controller('api/crm/phones')
export class PhonesController {
  constructor(@InjectRepository(Phone) private readonly repository: Repository<Phone>) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Phone[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body()data: Phone): Promise<Phone> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body()data: Phone): Promise<Phone> {
    return await this.repository.save(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Phone> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
