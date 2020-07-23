import { Body, Controller, Delete, Get, Param, Post, Put, Query, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import { GroupsMembershipService } from '../services/group-membership.service';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { CreateGroupMembershipDto } from '../dto/membership/create-group-membership.dto';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';

@ApiTags('Groups Membership')
@Controller('api/groups/member')
export class GroupMembershipController {
  constructor(private readonly service: GroupsMembershipService) {
  }

  @Get()
  async findAll(@Query() req: GroupMembershipSearchDto): Promise<GroupMembershipDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body()data: CreateGroupMembershipDto): Promise<GroupMembershipDto> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body()data: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    return await this.service.update(data);
  }

  @Patch()
  async updateIsActive(@Body()data: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    return await this.service.updateIsActive(data);
  }

  @Get(":id")
  async findOne(@Param('id') id: number): Promise<GroupMembershipDto> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }

}
