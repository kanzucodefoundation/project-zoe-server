import { HttpModule, Module } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorModule } from 'src/vendor/vendor.module';
import { appEntities } from 'src/config';
import { AppService } from 'src/app.service';
import Help from './entities/help.entity';

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  controllers: [HelpController],
  providers: [HelpService, AppService],
  exports: [HelpService],
})
export class HelpModule {}
