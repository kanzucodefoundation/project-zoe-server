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
