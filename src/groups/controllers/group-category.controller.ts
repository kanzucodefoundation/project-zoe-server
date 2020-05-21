import { Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GroupCategoriesService } from '../services/group-categories.service';
import GroupCategory from '../entities/groupCategory.entity';
import SearchDto from '../../shared/dto/search.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Group Categories')
@Controller('api/groups/category')
export class GroupCategoryController {
  constructor(private readonly service: GroupCategoriesService) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<GroupCategory[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(data: GroupCategory): Promise<GroupCategory> {
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
