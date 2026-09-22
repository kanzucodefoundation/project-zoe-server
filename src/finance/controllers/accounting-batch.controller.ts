import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import {
  AccountingService,
  BatchPostResult,
} from '../services/accounting.service';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

export class PostBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  // QuickBooks is called once per receipt; a larger batch would outlive the
  // request. Bigger runs should be split by the caller.
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  transactionIds: number[];
}

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Accounting')
@UseGuards(PermissionsGuard)
@Controller('api/finance/accounting')
export class AccountingBatchController {
  constructor(private readonly accountingService: AccountingService) {}

  /** Posts several approved transactions to QuickBooks in one request. */
  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('post-batch')
  postBatch(
    @Body() dto: PostBatchDto,
    @Request() req: any,
  ): Promise<BatchPostResult> {
    return this.accountingService.postMany(
      dto.transactionIds,
      req.user?.id ?? null,
    );
  }
}
