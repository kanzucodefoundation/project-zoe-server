
import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { UserTaskService } from '../user_task.service';
import SearchDto from '../../shared/dto/search.dto';
import Person from 'src/crm/entities/person.entity';
import { UserTask } from '../entities/user_task.entity';
import { ApiTags } from '@nestjs/swagger';
import { getRepository } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
import { User } from 'src/users/user.entity';

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

    // @Put(':id')
    // update(@Body() updateTaskDto: CreateTaskDto, @Param('Ministry') id):string{
    //     return `Update ${id} - Ministry: ${updateTaskDto.ministry}`;
    // }
    
    // @Get(":id")
    // async findOne(@Param('id') id: number): Promise<UserTask> {
    //     return await this.service.findOne(id);
    // }

    // @Delete(":id")
    // async remove(@Param('id') id: number): Promise<void> {
    //     await this.service.remove(id);
    // }

    @Get('userTasks')
    async findTheUserTasks() {
  
    const userTasks = await getRepository(UserTask)
    .createQueryBuilder("userTask")
    // .leftJoinAndSelect("appointmentTask.appointments", "appointment")
    // .innerJoinAndMapOne("task.appointmentTask", AppointmentTask, "appointmentTask", "task.id = appointmentTask.taskId")
    .innerJoinAndMapMany("userTask.appTask", AppointmentTask, "appTask", "userTask.appointmentTaskId = appTask.id")
    .innerJoinAndMapMany("userTask.user", Person, "user", "userTask.userId = user.id")
    .getMany();

    return userTasks;
    }

}

