import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppointmentService } from '../appointments.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from '../entities/appointment.entity';
import { getRepository } from 'typeorm';
import { Task } from 'src/tasks/task.entity';



@ApiTags('Appointments')
@Controller('api/appointment/appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentService: AppointmentService,
      
  ) {
  }


  @Get('assignedTasks')
  async findTheAssignedTasks() {

    const assignedTasks = await getRepository(Task)
      .createQueryBuilder("task")
      .leftJoinAndSelect("task.appointments", "appointment")
      // .innerJoinAndMapOne("person.groupMembership", GroupMembership, "groupMembership", "person.contactId = groupMembership.contactId")
      // .innerJoinAndMapMany("person.group", Group, "group", "groupMembership.groupId = group.id")
      // .where("groupMembership.role = :role", { role: "Volunteer" })
      .getMany();

      return assignedTasks;
  }




  @Get()
  index(): Promise<Appointment[]> {
    return this.appointmentService.findAll();
  }

  @Post()
  async create(@Body() data: Appointment): Promise<Appointment> {
    return this.appointmentService.create(data);
  }
}
