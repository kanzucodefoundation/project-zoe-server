import { HttpModule, Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { VendorModule } from 'src/vendor/vendor.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appEntities } from 'src/config';

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
