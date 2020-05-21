import { Module } from '@nestjs/common';
import { DayController } from './controllers/day.controller';
import { DayService } from './day.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Day } from './entities/day.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Day])],
  providers: [DayService],
  controllers: [
    DayController,
  ],
  exports: [DayService],
})
export class ServicesModule {
}
