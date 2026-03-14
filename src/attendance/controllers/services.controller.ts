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
import { ServiceAttendanceService } from '../services/service-attendance.service';
import {
  CreateServiceScheduleDto,
  UpdateServiceScheduleDto,
} from '../dto/service-schedule.dto';
import { CheckInDto, QuickGuestDto, RosterSearchDto } from '../dto/check-in.dto';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Attendance - Services')
@Controller('api/services')
export class ServicesController {
  constructor(
    private readonly serviceAttendanceService: ServiceAttendanceService,
  ) {}

  @Post('schedules')
  async createSchedule(
    @Body() dto: CreateServiceScheduleDto,
    @Request() req: any,
  ) {
    return this.serviceAttendanceService.createSchedule(dto, req.user.id);
  }

  @Put('schedules/:id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceScheduleDto,
    @Request() req: any,
  ) {
    return this.serviceAttendanceService.updateSchedule(id, dto, req.user.id);
  }

  @Get('schedules')
  async getSchedules(
    @Query('locationId', new ParseIntPipe({ optional: true }))
    locationId?: number,
    @Query('tags') tags?: string,
  ) {
    const tagArray = tags ? tags.split(',') : undefined;
    return this.serviceAttendanceService.getSchedules(locationId, tagArray);
  }

  @Get('today')
  async getTodayService(
    @Query('locationId', ParseIntPipe) locationId: number,
  ) {
    return this.serviceAttendanceService.getTodayService(locationId);
  }

  @Get(':serviceId/roster')
  async getRoster(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Query() searchDto: RosterSearchDto,
  ) {
    return this.serviceAttendanceService.getRoster(serviceId, searchDto);
  }

  @Post(':serviceId/checkin')
  async checkIn(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: CheckInDto,
    @Request() req: any,
  ) {
    return this.serviceAttendanceService.checkIn(serviceId, dto, req.user.id);
  }

  @Post(':serviceId/guest')
  async quickGuest(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: QuickGuestDto,
    @Request() req: any,
  ) {
    return this.serviceAttendanceService.quickGuest(
      serviceId,
      dto,
      req.user.id,
    );
  }

  @Get(':serviceId/stats')
  async getStats(@Param('serviceId', ParseIntPipe) serviceId: number) {
    return this.serviceAttendanceService.getStats(serviceId);
  }
}
