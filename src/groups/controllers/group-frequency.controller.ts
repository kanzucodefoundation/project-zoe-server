import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GroupMissingReportsService } from '../services/group-missing-reports.service';

import { EventFrequencyDto } from '../dto/event-frequency-search.dto';
import GroupCategoryReport from '../entities/groupCategoryReport.entity';

import { GroupSearchDto } from '../dto/group-search.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@ApiTags('Groups Report Frequency')
@Controller('api/groups/reportfrequency')
export class GroupReportFrequencyController {
  constructor(private readonly service: GroupMissingReportsService) {}

  @Get()
  async findAll(@Query() dto: EventFrequencyDto): Promise<GroupCategoryReport[]> {
    return await this.service.getFrequencyByCategory(dto)
  }
}
