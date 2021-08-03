import { Controller, Get, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import EventMetricsDto from '../dto/event-metrics-search.dto';
import { EventsService } from '../events.service';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Events Attendance')
@Controller('api/events/metrics')
export class EventsMetricsController {
  constructor(private readonly service: EventsService) {}

  @Get('raw')
  async findAll(@Query() dto: EventMetricsDto, @Request() req): Promise<any> {
    return this.service.loadMetrics(dto, req.user);
  }
}
