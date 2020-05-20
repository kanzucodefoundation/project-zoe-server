import { Module } from '@nestjs/common';
import { VolunteersController } from './controllers/volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Person from '../crm/entities/person.entity';
import Contact from '../crm/entities/contact.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Contact])],
  providers: [VolunteersService],
  controllers: [
    VolunteersController,
  ],
  exports: [VolunteersService],
})
export class ServicesModule {
}
