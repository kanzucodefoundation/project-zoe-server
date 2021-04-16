import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import EventMetricsDto from './dto/event-metrics-search.dto';
import { EventsService } from './events.service';

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
