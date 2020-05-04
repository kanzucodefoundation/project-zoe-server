import { Module } from '@nestjs/common';
import { TeamleadController } from './controllers/teamlead.controller';
import { TeamleadService } from './teamlead.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teamlead } from './entities/teamlead.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Teamlead])],
  providers: [TeamleadService],
  controllers: [
    TeamleadController,
  ],
  exports: [TeamleadService],
})
export class ServicesModule {
}
