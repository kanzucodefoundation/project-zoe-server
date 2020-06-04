import { Module } from '@nestjs/common';
import { AppointmentsController } from './controllers/appointments.controller';
import { AppointmentService } from './appointments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointments } from './entities/appointments.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointments])],
  providers: [AppointmentService],
  controllers: [
    AppointmentsController,
  ],
  exports: [AppointmentService],
})
export class AppointmentModule {
}
