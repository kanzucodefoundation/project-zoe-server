import { Module } from '@nestjs/common';
import { AppointmentTaskController } from './controllers/appointment_task.controller';
import { AppointmentTaskService } from './appointment_task.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentTask } from './entities/appointment_task.entity';


@Module({
    imports: [TypeOrmModule.forFeature([AppointmentTask])],
    providers: [AppointmentTaskService],
    controllers: [
        AppointmentTaskController,
    ],
    exports: [AppointmentTaskService],
})
export class AppointmentTaskModule {
}


