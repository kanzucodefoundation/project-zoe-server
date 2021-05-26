import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import { GroupsMembershipService } from '../services/group-membership.service';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import BatchGroupMembershipDto from '../dto/membership/batch-group-membership.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Groups Membership')
@Controller('api/groups/member')
export class GroupMembershipController {
  constructor(private readonly service: GroupsMembershipService) {}

  @Get()
  async findAll(
    @Query() req: GroupMembershipSearchDto,
  ): Promise<GroupMembershipDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: BatchGroupMembershipDto): Promise<any> {
    const created = await this.service.create(data);
    return {
      message: 'Operation succeeded',
      inserted: created,
    };
  }

  @Put()
  async update(
    @Body() data: UpdateGroupMembershipDto,
  ): Promise<GroupMembershipDto> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<GroupMembershipDto> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}
