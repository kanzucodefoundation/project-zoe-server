import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import Phone from '../entities/phone.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PhoneDto } from '../dto/phone.dto';
import {PhonesService} from "../phones.service"

@UseGuards(JwtAuthGuard)
@ApiTags('Crm Phones')
@Controller('api/crm/phones')
export class PhonesController {
  constructor(
    @InjectRepository(Phone) private readonly repository: Repository<Phone>,
    private readonly service: PhonesService
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Phone[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: PhoneDto): Promise<Phone[]> {
    return this.service.create(data);
  }

  @Put()
  async update(@Body() data: PhoneDto): Promise<Phone> {
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
