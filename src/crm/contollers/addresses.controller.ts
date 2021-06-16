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
import Address from '../entities/address.entity';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AddressesService } from '../addresses.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Crm Addresses')
@Controller('api/crm/addresses')
export class AddressesController {
  constructor(
    @InjectRepository(Address) private readonly repository: Repository<Address>,

    private readonly service:AddressesService
  ) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Address[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Address): Promise<Address> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Address): Promise<Address> {
    return await this.repository.save(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Address> {
    return await this.repository.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
