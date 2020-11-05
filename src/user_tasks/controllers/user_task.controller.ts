import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { UserTaskService } from '../user_task.service';
import SearchDto from '../../shared/dto/search.dto';
import Person from 'src/crm/entities/person.entity';
import { UserTask } from '../entities/user_task.entity';
import { ApiTags } from '@nestjs/swagger';
import { getRepository } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
import { User } from 'src/users/user.entity';
import { Appointment } from 'src/appointment/entities/appointment.entity';
import { Task } from 'src/tasks/task.entity';

// import { TaskDto } from 'src/auth/dto/task.dto';
// import { CreateTaskDto } from 'src/auth/dto/create-task.dto';
@ApiTags("UserTask")
@Controller('api/user-task')
export class UserTaskController {
    constructor(private readonly service: UserTaskService) {
    }

    @Get()
        async findAll(@Query() req): Promise<UserTask[]> {
            return this.service.findAll(req);
    }
    @Post()
    async create(@Body() data: UserTask): Promise<UserTask> {
        return this.service.create(data);
    }

    @Get('userTasks')
    async findTheUserTasks() {  
        const userTasks = await getRepository(UserTask)
            .createQueryBuilder("userTask")
            .innerJoinAndMapOne("userTask.appTask", AppointmentTask, "appTask", "userTask.appointmentTaskId = appTask.id")
            .innerJoinAndMapOne("appTask.app", Appointment, "app", "appTask.appointmentId = app.id")
            .innerJoinAndMapOne("appTask.task", Task, "task", "appTask.taskId = task.id")
            .innerJoinAndMapOne("userTask.user", Person, "user", "userTask.userId = user.id")
            .getMany();

            return userTasks;
    }

    @Get(':id')
    async findAUserTask(@Param('id') id: number) {  
        const singleUserTask = await getRepository(UserTask)
                .createQueryBuilder("userTask")
                .innerJoinAndMapMany("userTask.appTask", AppointmentTask, "appTask", "userTask.appointmentTaskId = appTask.id")
                .innerJoinAndMapMany("appTask.app", Appointment, "app", "appTask.appointmentId = app.id")
                .innerJoinAndMapOne("appTask.task", Task, "task", "appTask.taskId = task.id")
                .innerJoinAndMapOne("userTask.user", Person, "user", "userTask.userId = user.id")
                .where("userTask.userId = :userId", { userId: id }) 
                .getMany();

                return singleUserTask;
    }  

}