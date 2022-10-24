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

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Groups Combo")
@Controller("api/groups/combo")
export class GroupComboController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  async combo(
    @Query() req: GroupSearchDto,
    @Request() rawRequest: any,
  ): Promise<Group[]> {
    console.log("combo>>>>", rawRequest.user);
    return this.service.combo(req, rawRequest.user);
  }
}
