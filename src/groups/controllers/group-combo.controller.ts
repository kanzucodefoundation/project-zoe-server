import { Controller, Get, Query } from '@nestjs/common';
import { GroupsService } from '../services/groups.service';
import Group from '../entities/group.entity';
import { ApiTags } from '@nestjs/swagger';
import { GroupSearchDto } from '../dto/group-search.dto';

@ApiTags('Groups Combo')
@Controller('api/groups/combo')
export class GroupComboController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  async combo(@Query() req: GroupSearchDto): Promise<Group[]> {
    return this.service.combo(req);
  }
}
