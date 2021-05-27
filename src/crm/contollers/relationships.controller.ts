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
import Relationship from '../entities/relationship.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Crm Relationships')
@Controller('api/crm/relationships')
export class RelationshipsController {
  constructor(
    @InjectRepository(Relationship)
    private readonly repository: Repository<Relationship>,
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Relationship[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Relationship): Promise<Relationship> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Relationship): Promise<Relationship> {
    return await this.repository.save(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Relationship> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
