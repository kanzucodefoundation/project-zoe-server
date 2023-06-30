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
  Request,
} from "@nestjs/common";
import { GroupsService } from "../services/groups.service";
import SearchDto from "../../shared/dto/search.dto";
import { ApiTags } from "@nestjs/swagger";
import GroupListDto from "../dto/group-list.dto";
import CreateGroupDto from "../dto/create-group.dto";
import UpdateGroupDto from "../dto/update-group.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "../../utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Groups")
@Controller("api/groups/group")
export class GroupController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  async findAll(
    @Query() req: SearchDto,
    @Request() rawRequest: any,
  ): Promise<GroupListDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(
    @Body() data: CreateGroupDto,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.create(data, rawRequest.user);
  }

  @Put()
  async update(
    @Body() data: UpdateGroupDto,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.update(data, rawRequest.user);
  }

  @Get(":id")
  async findOne(
    @Param("id") id: number,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.findOne(id, true, rawRequest.user);
  }

  @Delete(":id")
  async remove(
    @Param("id") id: number,
    @Request() rawRequest: any,
  ): Promise<void> {
    await this.service.remove(id, rawRequest.user);
  }
}
