import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { GroupsService } from '../services/groups.service';
import Group from '../entities/group.entity';
import SearchDto from '../../shared/dto/search.dto';
import CreateGroupDto from '../dto/create-group.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Groups')
@Controller('api/groups/groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Group[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(data: CreateGroupDto): Promise<Group> {
    return await this.service.create(data);
  }

  @Put()
  async update(data: Group): Promise<Group> {
    return await this.service.update(data);
  }

  @Get(":id")
  async findOne(@Param('id') id:number): Promise<Group> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param('id') id:number): Promise<void> {
    await this.service.remove(id);
  }
}