import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import GroupEventSearchDto from './dto/group-event-search.dto';
import GroupEventDto from './dto/group-event.dto';
import GroupReportDto from './dto/group-report.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Event Group Reports')
@Controller('api/events/groupreports')
export class GroupReportsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  async getUnsubmitted(
    @Query() dto: GroupEventSearchDto,
    @Request() req,
  ): Promise<GroupReportDto[]> {
    console.log('======GROUP REPORTS CONTROLLER: =======', dto);
    return this.service.findUnsubmitted(dto);
  }
}
