import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GroupSearchDto } from '../dto/group-search.dto';
import { GroupMissingReportsService } from '../services/group-missing-reports.service';

@ApiTags('Groups Category Combo')
@Controller('api/groups/groupscombo')
export class GroupCategoryComboController {
  constructor(private readonly service: GroupMissingReportsService) {}

  @Get()
  async combo(@Query() req: GroupSearchDto): Promise<any[]> {
    return this.service.combo(req);
  }
}
