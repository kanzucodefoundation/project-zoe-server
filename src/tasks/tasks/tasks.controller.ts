/*
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from '../tasks.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from '../task.entity';

@ApiTags('Services Tasks')
@Controller('api/tasks')
export class TasksController {
    constructor(
        private readonly tasksService: TasksService,
    ) {
    }
    @Get()
    index(): Promise<Task[]> {
        return this.tasksService.findAll();
    }

    @Post()
    async create(@Body() data: Task): Promise<Task> {
        return this.tasksService.create(data);
    }
}
*/
import { Controller, Delete, Get, Param, Post, Put, Query, Body } from '@nestjs/common';
import { TasksService } from '../tasks.service';
import SearchDto from '../../shared/dto/search.dto';
import { Task } from '../task.entity';
import { ApiTags } from '@nestjs/swagger';

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
/*
    @Put()
    async update(data: Task): Promise<Task> {
        return await this.service.update(data);
    }
    */
    @Put(':id/update')
    async update(@Param('id') id, @Body() taskData: Task): Promise<any> {
        taskData.id = Number(id);
        //console.log('Update #' + taskData.id)
        return this.service.update(taskData);
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
