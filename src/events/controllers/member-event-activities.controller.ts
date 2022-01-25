import { MemberEventActivitiesDto } from "./../dto/member-event-activities.dto";
import { MemberEventActivities } from "./../entities/member-event-activities.entity";
import { MemberEventActivitiesService } from "./../member-event-activities.service";

import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { CreateMemberEventActivitiesDto } from "../dto/create-member-event-activities.dto";
import { ApiTags } from "@nestjs/swagger";

import MemberEventActivitiesSearchDto from "../dto/member-event-activities-search.dto";
import { UpdateMemberEventActivitiesDto } from "../dto/update-member-event-activities.dto";

@ApiTags(" MemberEventActivities")
@Controller("api/events/member")
export class MemberEventActivitiesController {
  constructor(private readonly service: MemberEventActivitiesService) {}

  @Post()
  async create(
    @Body() data: MemberEventActivitiesDto,
  ): Promise<MemberEventActivitiesDto> {
    return await this.service.create(data);
  }

  @Get()
  async findAll(): Promise<MemberEventActivities[]> {
    return await this.service.findAll();
  }

  @Get("/:id")
  async findOne(@Param("id") id: number) {
    return await this.service.findOne(id);
  }

  @Put()
  async update(
    @Body() data: UpdateMemberEventActivitiesDto,
  ): Promise<CreateMemberEventActivitiesDto | any> {
    return await this.service.update(data);
  }

  @Delete("/:id")
  async remove(@Param("id") id: number): Promise<void> {
    return await this.service.remove(id);
  }
}
