import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  Patch,
  Logger,
} from "@nestjs/common";
import { GroupCategoriesService } from "../services/group-categories.service";
import GroupCategory from "../entities/groupCategory.entity";
import SearchDto from "../../shared/dto/search.dto";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { Repository, Connection } from "typeorm";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Group Categories")
@Controller("api/groups/category")
export class GroupCategoryController {
  private readonly repository: Repository<GroupCategory>;
  private readonly logger = new Logger(GroupCategoryController.name);
  constructor(private readonly service: GroupCategoriesService) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<GroupCategory[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() { name }: { name: string }): Promise<GroupCategory> {
    const groupCategory = new GroupCategory();
    groupCategory.name = name;
    return await this.service.create(groupCategory);
  }

  @Patch()
  async update(
    @Body() { id, name }: { id: number; name: string },
  ): Promise<GroupCategory> {
    console.log({ id, name });
    return await this.service.update(id, name);
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
