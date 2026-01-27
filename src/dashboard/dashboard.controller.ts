import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from '../utils/sentry.interceptor';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Dashboard')
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(
    @Request() request,
    @Query('timeRange') timeRange?: string,
    @Query('groupId') groupId?: string,
  ): Promise<any> {
    const parsedGroupId = groupId ? parseInt(groupId, 10) : undefined;
    return this.dashboardService.getSundayServiceSummary(
      request.user,
      timeRange || 'month',
      !isNaN(parsedGroupId) ? parsedGroupId : undefined,
    );
  }
}
