import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { GroupMissingReportsService } from '../services/group-missing-reports.service';
import GroupReportDto from '../../events/dto/group-report.dto';
import { GroupMissingReportSearchDto } from '../dto/group-missing-report-search.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Groups Missing Reports')
@Controller('api/groups/groupreports')
export class GroupReportsController {
  constructor(private readonly service: GroupMissingReportsService) {}

  @Get()
  async getUnsubmitted(
    @Query() dto: GroupMissingReportSearchDto,
    @Request() req,
  ): Promise<GroupReportDto[]> {
    return this.service.findMissingReports(dto);
  }
}
