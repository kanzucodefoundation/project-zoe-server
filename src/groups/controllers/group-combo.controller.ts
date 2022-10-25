import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { GroupsService } from "../services/groups.service";
import Group from "../entities/group.entity";
import { ApiTags } from "@nestjs/swagger";
import { GroupSearchDto } from "../dto/group-search.dto";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { GroupCategoryNames } from "../enums/groups";

@UseInterceptors(SentryInterceptor)
@ApiTags("Groups Combo")
@Controller("api/groups/combo")
export class GroupComboController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async combo(
    @Query() req: GroupSearchDto,
    @Request() rawRequest: any,
  ): Promise<Group[]> {
    return this.service.combo(req, rawRequest.user);
  }

  @Get("locations")
  async locations(
    @Query() req: GroupSearchDto,
    @Request() rawRequest: any,
  ): Promise<Group[]> {
    req.categories = [GroupCategoryNames.LOCATION];
    return this.service.combo(req, rawRequest.user);
  }
}
