
import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { TasksService } from '../tasks.service';
import SearchDto from '../../shared/dto/search.dto';
import { Task } from '../task.entity';
import { ApiTags } from '@nestjs/swagger';
import { TaskDto } from 'src/auth/dto/task.dto';
import { CreateTaskDto } from 'src/auth/dto/create-task.dto';
@ApiTags("Tasks")
@Controller('api/tasks')
export class TasksController {
    constructor(private readonly service: TasksService) {
    }

    @Get()
    async findAll(@Query() req: SearchDto): Promise<Task[]> {
        return this.service.findAll(req);
    }
    @Post()
    async create(@Body() data: Task): Promise<Task> {
        return this.service.create(data);
    }

    @Put(':id')
    update(@Body() updateTaskDto: CreateTaskDto, @Param('id') id):string{
        return `Update ${id} - Ministry: ${updateTaskDto.ministry}`;
    }
    
    @Get(":id")
    async findOne(@Param('id') id: number): Promise<Task> {
        return await this.service.findOne(id);
    }

    @Delete(":id")
    async remove(@Param('id') id: number): Promise<void> {
        await this.service.remove(id);
    }
}
