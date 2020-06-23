import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { BlockedDateService } from '../blocked_date.service';
import SearchDto from '../../shared/dto/search.dto';
import Person from 'src/crm/entities/person.entity';
import { BlockedDate } from '../entities/blocked_date.entity';
import { ApiTags } from '@nestjs/swagger';
import { getRepository } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
import { User } from 'src/users/user.entity'

// import { TaskDto } from 'src/auth/dto/task.dto';
// import { CreateTaskDto } from 'src/auth/dto/create-task.dto';

@ApiTags("Blocked Date")
@Controller('api/blocked-date')
export class BlockedDateController {
    constructor(private readonly service: BlockedDateService) {
    }

    @Get()
    async findAll(@Query() req): Promise<BlockedDate[]> {
        return this.service.findAll(req);
    }
    @Post()
    async create(@Body() data: BlockedDate): Promise<BlockedDate> {
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

    @Get('blockedDates')
    async findTheBlockedDates() {
  
    const blockDates = await getRepository(BlockedDate)
    .createQueryBuilder("blockedDates")
    // .leftJoinAndSelect("appointmentTask.appointments", "appointment")
    // .innerJoinAndMapOne("task.appointmentTask", AppointmentTask, "appointmentTask", "task.id = appointmentTask.taskId")
    .innerJoinAndMapMany("blockDates.appTask", AppointmentTask, "appTask", "blockDates.appointmentTaskId = appTask.id")
    .innerJoinAndMapMany("blockDates.user", Person, "user", "blockDates.userId = user.id")
    .getMany();

    return blockDates;
    }

}

