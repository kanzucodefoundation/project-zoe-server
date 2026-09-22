import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { AccountingService } from '../services/accounting.service';
import { ApplySetupDto } from '../dto/accounting-setup.dto';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Accounting')
@UseGuards(PermissionsGuard)
@Controller('api/finance/transactions/:id/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('preflight')
  preflight(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.preflight(id);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('setup')
  getSetup(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.getSetup(id);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('setup')
  applySetup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplySetupDto,
  ) {
    return this.accountingService.applySetup(id, dto);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('preview')
  preview(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.preview(id);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('post')
  post(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.accountingService.post(id, req.user?.id ?? null);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('posting')
  getPosting(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.getPosting(id);
  }
}
