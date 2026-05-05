import {
  Controller,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { ServiceRecordingService } from './service-recording.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Service Recording')
@Controller('api/service-recording')
export class ServiceRecordingController {
  constructor(private readonly service: ServiceRecordingService) {}

  @Post('guests/bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadGuests(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.bulkUploadGuests(req.tenantId, req.user.id, file);
  }

  @Post('believers/bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadBelievers(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.bulkUploadBelievers(req.tenantId, req.user.id, file);
  }

  @Post('redzone/bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadRedZone(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.bulkUploadRedZone(req.tenantId, req.user.id, file);
  }
}
