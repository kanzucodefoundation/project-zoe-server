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
import { InjectRepository } from '@nestjs/typeorm';
import Email from '../entities/email.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { EmailService } from '../emails.service';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Emails')
@Controller('api/crm/emails')
export class EmailsController {
  constructor(private readonly service: EmailService) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Email[]> {
    return await this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: Email): Promise<Email> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Email): Promise<Email> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Email> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.delete(id);
  }
}
