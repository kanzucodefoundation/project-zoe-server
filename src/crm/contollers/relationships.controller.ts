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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Relationship from '../entities/relationship.entity';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { RelationshipsService } from '../relationships.service';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Relationships')
@Controller('api/crm/relationships')
export class RelationshipsController {
  constructor(
    private readonly service: RelationshipsService,
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Relationship[]> {
    return await this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: Relationship): Promise<Relationship> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Relationship): Promise<Relationship> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Relationship> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}
