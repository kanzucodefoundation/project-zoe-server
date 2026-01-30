import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { ReportsService } from '../services/reports.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Reports')
@Controller('api/finance/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('summary')
  async getReconciliationSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('accountId') accountId?: number,
  ): Promise<any> {
    return this.service.getReconciliationSummary(startDate, endDate, accountId);
  }

  @Get('distributions')
  async getDistributionsByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any> {
    return this.service.getDistributionsByPeriod(startDate, endDate);
  }

  @Get('locations/:id')
  async getLocationSummary(
    @Param('id') id: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any> {
    return this.service.getLocationSummary(id, startDate, endDate);
  }
}
