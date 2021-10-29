import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { GroupsService } from '../services/groups.service';
import Group from '../entities/group.entity';
import { ApiTags } from '@nestjs/swagger';
import { GroupSearchDto } from '../dto/group-search.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@ApiTags('Groups Combo')
@Controller('api/groups/combo')
export class GroupComboController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  async combo(@Query() req: GroupSearchDto): Promise<Group[]> {
    return this.service.combo(req);
  }
}
