import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { GroupCategoriesService } from '../services/group-categories.service';
import GroupCategory from '../entities/groupCategory.entity';
import SearchDto from '../../shared/dto/search.dto';
import CreateGroupCategoryDto from '../dto/create-group-category.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Group Categories')
@Controller('api/groups/categories')
export class GroupCategoriesController {
  constructor(private readonly service: GroupCategoriesService) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<GroupCategory[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(data: CreateGroupCategoryDto): Promise<GroupCategory> {
    return await this.service.create(data);
  }

  @Put()
  async update(data: GroupCategory): Promise<GroupCategory> {
    return await this.service.update(data);
  }

  @Get(":id")
  async findOne(@Param('id') id:number): Promise<GroupCategory> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param('id') id:number): Promise<void> {
    await this.service.remove(id);
  }
}
