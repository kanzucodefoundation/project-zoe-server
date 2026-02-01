import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { AccountsService } from '../services/accounts.service';
import {
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  SearchFinancialAccountDto,
} from '../dto/financial-account.dto';
import FinancialAccount from '../entities/financial-account.entity';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Accounts')
@Controller('api/finance/accounts')
export class FinancialAccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  async findAll(
    @Query() query: SearchFinancialAccountDto,
  ): Promise<FinancialAccount[]> {
    return this.service.findAll(query);
  }

  @Post()
  async create(
    @Body() data: CreateFinancialAccountDto,
    @Request() req: any,
  ): Promise<FinancialAccount> {
    return this.service.create(data, req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<FinancialAccount> {
    return this.service.findOne(id);
  }

  @Put()
  async update(
    @Body() data: UpdateFinancialAccountDto,
    @Request() req: any,
  ): Promise<FinancialAccount> {
    return this.service.update(data, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: any): Promise<void> {
    return this.service.remove(id, req.user);
  }
}
