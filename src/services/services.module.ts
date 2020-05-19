import { Module } from '@nestjs/common';
import { VolunteersController } from './controllers/volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Volunteer } from './entities/volunteer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Volunteer])],
  providers: [VolunteersService],
  controllers: [
    VolunteersController,
  ],
  exports: [VolunteersService],
})
export class ServicesModule {
}
