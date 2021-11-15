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
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import GroupMembershipRequestDto from "../dto/membershipRequest/group-membership-request.dto";
import { NewRequestDto } from "../dto/membershipRequest/new-request.dto";
import GroupMembershipRequestSearchDto from "../dto/membershipRequest/search-request.dto";
import { GroupMembershipRequestService } from "../services/group-membership-request.service";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Groups Membership Request")
@Controller("api/groups/request")
export class GroupMembershipReqeustController {
  constructor(private readonly service: GroupMembershipRequestService) {}

  @Get()
  async findAll(
    @Query() req: GroupMembershipRequestSearchDto,
  ): Promise<GroupMembershipRequestDto[]> {
    return await this.service.findAll(req);
  }

  @Post()
  async create(
    @Body() data: NewRequestDto,
  ): Promise<GroupMembershipRequestDto | any> {
    return await this.service.create(data);
  }

  @Put()
  async update(): Promise<any> {
    return await this.service.update;
  }

  @Get(":id")
  async findOne(@Param("id") id: number): Promise<any> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: number): Promise<any> {
    return await this.service.remove(id);
  }
}
