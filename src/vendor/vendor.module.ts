import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { HttpModule } from '@nestjs/axios';
import { GoogleService } from './google.service';
import { AfricasTalkingService } from './africas-talking.service';

@Module({
  imports: [HttpModule],
  controllers: [VendorController],
  providers: [VendorService, GoogleService, AfricasTalkingService],
  exports: [GoogleService, AfricasTalkingService],
})
export class VendorModule {}
