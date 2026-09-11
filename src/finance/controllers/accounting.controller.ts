import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { AccountingService } from '../services/accounting.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Accounting')
@Controller('api/finance/transactions/:id/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('preflight')
  preflight(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.preflight(id);
  }

  @Get('preview')
  preview(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.preview(id);
  }

  @Post('post')
  post(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.accountingService.post(id, req.user?.id ?? null);
  }

  @Get('posting')
  getPosting(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.getPosting(id);
  }
}
