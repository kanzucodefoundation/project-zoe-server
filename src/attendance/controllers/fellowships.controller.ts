import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { FellowshipAttendanceService } from '../services/fellowship-attendance.service';
import {
  CreateFellowshipScheduleDto,
  UpdateFellowshipScheduleDto,
} from '../dto/fellowship-schedule.dto';
import {
  FellowshipCheckInDto,
  QuickFellowshipVisitorDto,
} from '../dto/fellowship-check-in.dto';
import { RosterSearchDto } from '../dto/check-in.dto';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Attendance - Fellowships')
@Controller('api/fellowships')
export class FellowshipsController {
  constructor(
    private readonly fellowshipAttendanceService: FellowshipAttendanceService,
  ) {}

  @Post('schedules')
  async createSchedule(
    @Body() dto: CreateFellowshipScheduleDto,
    @Request() req: any,
  ) {
    return this.fellowshipAttendanceService.createSchedule(dto, req.user.id);
  }

  @Put('schedules/:id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFellowshipScheduleDto,
  ) {
    return this.fellowshipAttendanceService.updateSchedule(id, dto);
  }

  @Get('schedules')
  async getSchedules(
    @Query('fellowshipGroupId', new ParseIntPipe({ optional: true }))
    fellowshipGroupId?: number,
  ) {
    return this.fellowshipAttendanceService.getSchedules(fellowshipGroupId);
  }

  @Get('today')
  async getTodayFellowship(
    @Query('fellowshipGroupId', ParseIntPipe) fellowshipGroupId: number,
  ) {
    return this.fellowshipAttendanceService.getTodayFellowship(fellowshipGroupId);
  }

  @Get(':fellowshipId/roster')
  async getRoster(
    @Param('fellowshipId', ParseIntPipe) fellowshipId: number,
    @Query() searchDto: RosterSearchDto,
  ) {
    return this.fellowshipAttendanceService.getRoster(fellowshipId, searchDto);
  }

  @Post(':fellowshipId/checkin')
  async checkIn(
    @Param('fellowshipId', ParseIntPipe) fellowshipId: number,
    @Body() dto: FellowshipCheckInDto,
    @Request() req: any,
  ) {
    return this.fellowshipAttendanceService.checkIn(
      fellowshipId,
      dto,
      req.user.id,
    );
  }

  @Post(':fellowshipId/visitor')
  async quickVisitor(
    @Param('fellowshipId', ParseIntPipe) fellowshipId: number,
    @Body() dto: QuickFellowshipVisitorDto,
    @Request() req: any,
  ) {
    return this.fellowshipAttendanceService.quickVisitor(
      fellowshipId,
      dto,
      req.user.id,
    );
  }
}
