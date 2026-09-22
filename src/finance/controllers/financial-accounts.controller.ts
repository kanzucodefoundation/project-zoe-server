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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import {
  AccountsService,
  QboAccountOption,
} from '../services/accounts.service';
import {
  CreateAccountFromQuickBooksDto,
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  SearchFinancialAccountDto,
} from '../dto/financial-account.dto';
import FinancialAccount from '../entities/financial-account.entity';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Accounts')
@UseGuards(PermissionsGuard)
@Controller('api/finance/accounts')
export class FinancialAccountsController {
  constructor(private readonly service: AccountsService) {}

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get()
  async findAll(
    @Query() query: SearchFinancialAccountDto,
  ): Promise<FinancialAccount[]> {
    return this.service.findAll(query);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post()
  async create(
    @Body() data: CreateFinancialAccountDto,
    @Request() req: any,
  ): Promise<FinancialAccount> {
    return this.service.create(data, req.user);
  }

  /**
   * The QuickBooks chart of accounts. Declared before ':id' so "quickbooks" is
   * never swallowed as an account id.
   */
  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('quickbooks')
  async listQuickBooksAccounts(): Promise<QboAccountOption[]> {
    return this.service.listQuickBooksAccounts();
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('quickbooks')
  async createFromQuickBooks(
    @Body() data: CreateAccountFromQuickBooksDto,
    @Request() req: any,
  ): Promise<FinancialAccount> {
    return this.service.createFromQuickBooks(data, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get(':id')
  async findOne(@Param('id') id: number): Promise<FinancialAccount> {
    return this.service.findOne(id);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Put()
  async update(
    @Body() data: UpdateFinancialAccountDto,
    @Request() req: any,
  ): Promise<FinancialAccount> {
    return this.service.update(data, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: any): Promise<void> {
    return this.service.remove(id, req.user);
  }
}
