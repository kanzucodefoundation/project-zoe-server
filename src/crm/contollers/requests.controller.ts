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
import Request from '../entities/request.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Crm Requests')
@Controller('api/crm/requests')
export class RequestsController {
  constructor(
    @InjectRepository(Request) private readonly repository: Repository<Request>,
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Request[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Request): Promise<Request> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Request): Promise<Request> {
    return await this.repository.save(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Request> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
