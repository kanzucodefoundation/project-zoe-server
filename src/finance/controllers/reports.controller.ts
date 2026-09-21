import {
  Controller,
  Res,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { ReportsService } from '../services/reports.service';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Reports')
@UseGuards(PermissionsGuard)
@Controller('api/finance/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('summary')
  async getReconciliationSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('accountId') accountId?: number,
  ): Promise<any> {
    return this.service.getReconciliationSummary(startDate, endDate, accountId);
  }

  /**
   * CSV export for the Financial Reports page. Served as a normal authenticated
   * response body so the client can fetch it with its usual bearer token and
   * save the blob, rather than needing a credential-less URL.
   */
  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('export')
  async exportReconciliation(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: any,
    @Query('accountId') accountId?: number,
  ): Promise<void> {
    const csv = await this.service.exportReconciliationCsv(
      startDate,
      endDate,
      accountId,
    );

    const safe = (value: string) =>
      String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '');
    const filename = `reconciliation-${safe(startDate)}-to-${safe(
      endDate,
    )}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('distributions')
  async getDistributionsByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any> {
    return this.service.getDistributionsByPeriod(startDate, endDate);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('locations/:id')
  async getLocationSummary(
    @Param('id') id: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any> {
    return this.service.getLocationSummary(id, startDate, endDate);
  }
}
