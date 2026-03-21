import { Module } from '@nestjs/common';
import { ServiceRecordingController } from './service-recording.controller';
import { ServiceRecordingService } from './service-recording.service';

@Module({
  controllers: [ServiceRecordingController],
  providers: [ServiceRecordingService],
})
export class ServiceRecordingModule {}
