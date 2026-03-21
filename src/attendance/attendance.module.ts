import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { FellowshipsController } from './controllers/fellowships.controller';
import { ServiceAttendanceService } from './services/service-attendance.service';
import { FellowshipAttendanceService } from './services/fellowship-attendance.service';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';

@Module({
  controllers: [ServicesController, FellowshipsController],
  providers: [
    ServiceAttendanceService,
    FellowshipAttendanceService,
    TenantContextInterceptor,
  ],
  exports: [ServiceAttendanceService, FellowshipAttendanceService],
})
export class AttendanceModule {}
