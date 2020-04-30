import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
    ) {
    }

    async findAll(): Promise<Task[]> {
        return await this.taskRepository.find();
    }

    async create(data: Task): Promise<Task> {
        return await this.taskRepository.save(data);
    }
}