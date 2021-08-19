import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactSearchDto } from '../dto/contact-search.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import Company from '../entities/company.entity';
import CompanyListDto from '../dto/company-list.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import ContactListDto from '../dto/contact-list.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { CompanyService } from '../company.service';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Companies')
@Controller('api/crm/companies')
export class CompaniesController {
  constructor(
    private readonly service: CompanyService,
  ) {}

  @Get()
  async findAll(@Query() req: ContactSearchDto): Promise<Company[]> {
    return await this.service.findAll(req)
  }

  @Get('combo')
  async findCombo(@Query() req: ContactSearchDto): Promise<CompanyListDto[]> {
    return await this.service.findCombo(req)
  }

  @Post()
  async create(@Body() data: CreateCompanyDto): Promise<ContactListDto> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Company): Promise<Company> {
    return await this.service.update(data);
  }
}
