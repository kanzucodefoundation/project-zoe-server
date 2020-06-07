
import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { AppointmentTaskService } from '../appointment_task.service';
import SearchDto from '../../shared/dto/search.dto';
import { AppointmentTask } from '../entities/appointment_task.entity';
import { ApiTags } from '@nestjs/swagger';
// import { TaskDto } from 'src/auth/dto/task.dto';
// import { CreateTaskDto } from 'src/auth/dto/create-task.dto';
@ApiTags("AppointmentTask")
@Controller('api/appointment-task')
export class AppointmentTaskController {
    constructor(private readonly service: AppointmentTaskService) {
    }

    @Get()
    async findAll(@Query() req): Promise<AppointmentTask[]> {
        return this.service.findAll(req);
    }
    @Post()
    async create(@Body() data: AppointmentTask): Promise<AppointmentTask> {
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
}


