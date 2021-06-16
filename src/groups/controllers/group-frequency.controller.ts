import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GroupMissingReportsService } from '../services/group-missing-reports.service';
import { EventFrequencyDto } from '../dto/event-frequency-search.dto';
import GroupCategoryReport from '../entities/groupCategoryReport.entity';

@ApiTags('Groups Report Frequency')
@Controller('api/groups/reportfrequency')
export class GroupReportFrequencyController {
  constructor(private readonly service: GroupMissingReportsService) {}

  @Get()
  async findAll(@Query() dto: EventFrequencyDto): Promise<GroupCategoryReport[]> {
    return await this.service.getFrequencyByCategory(dto)
  }
}
