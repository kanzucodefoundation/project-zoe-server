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
import Phone from '../entities/phone.entity';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PhoneDto } from '../dto/phone.dto';
import {PhonesService} from "../phones.service"
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Phones')
@Controller('api/crm/phones')
export class PhonesController {
  constructor(
    private readonly service: PhonesService
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Phone[]> {
    return await this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: PhoneDto): Promise<Phone[]> {
    return this.service.create(data);
  }

  @Put()
  async update(@Body() data: PhoneDto): Promise<Phone> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Phone> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}
