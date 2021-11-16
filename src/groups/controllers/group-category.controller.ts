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
  UseInterceptors,
} from "@nestjs/common";
import { GroupCategoriesService } from "../services/group-categories.service";
import GroupCategory from "../entities/groupCategory.entity";
import SearchDto from "../../shared/dto/search.dto";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Group Categories")
@Controller("api/groups/category")
export class GroupCategoryController {
  constructor(private readonly service: GroupCategoriesService) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<GroupCategory[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: GroupCategory): Promise<GroupCategory> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: GroupCategory): Promise<GroupCategory> {
    return await this.service.update(data);
  }

  @Get(":id")
  async findOne(@Param("id") id: number): Promise<GroupCategory> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    console.log("*****", id);
    await this.service.remove(id);
  }
}
