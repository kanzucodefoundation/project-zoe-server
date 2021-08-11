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
import Address from '../entities/address.entity';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AddressesService } from '../addresses.service';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Addresses')
@Controller('api/crm/addresses')
export class AddressesController {
  constructor(private readonly service: AddressesService) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Address[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: Address): Promise<Address> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Address): Promise<Address> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Address> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.delete(id);
  }
}
