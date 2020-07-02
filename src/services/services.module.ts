import { Module } from '@nestjs/common';
import { VolunteeringController } from './controllers/volunteering.controller';
import { VolunteeringService } from './volunteering.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Person from '../crm/entities/person.entity';
import Contact from '../crm/entities/contact.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Contact])],
  providers: [VolunteeringService],
  controllers: [
    VolunteeringController,
  ],
  exports: [VolunteeringService],
})
export class ServicesModule {
}
