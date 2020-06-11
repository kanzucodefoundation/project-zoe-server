import { Module } from '@nestjs/common';
import { AppointmentsController } from './controllers/appointment.controller';
import { AppointmentService } from './appointments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
  providers: [AppointmentService],
  controllers: [
    AppointmentsController,
  ],
  exports: [AppointmentService],
})
export class AppointmentModule {
}
