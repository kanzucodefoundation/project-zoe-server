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
import Email from '../entities/email.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Crm Emails')
@Controller('api/crm/emails')
export class EmailsController {
  constructor(
    @InjectRepository(Email) private readonly repository: Repository<Email>,
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Email[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Email): Promise<Email> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Email): Promise<Email> {
    return await this.repository.save(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Email> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
