import { HttpModule, Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

import { GoogleService } from './google.service';

@Module({
  imports: [HttpModule],
  controllers: [VendorController],
  providers: [VendorService, GoogleService],
  exports: [GoogleService],
})
export class VendorModule {
}
