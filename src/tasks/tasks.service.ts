/*
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
*/
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { RegisterTaskDto } from '../auth/dto/register-task.dto';
import SearchDto from '../shared/dto/search.dto';
@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly repository: Repository<Task>,
    ) { }

    async findAll(req: SearchDto): Promise<Task[]> {
        return await this.repository.find({
            skip: req.skip,
            take: req.limit,
        });
    }

    async create(data: Task): Promise<Task> {
        return await this.repository.save(data);
    }

    async register(dto: RegisterTaskDto): Promise<Task> {
        const task = new Task();
        task.id = dto.id;
        task.ministry = dto.ministry;
        task.taskName = dto.taskName;
        task.taskDescription = dto.taskDescription
        return await this.repository.save(task);
    }

    findOne(id: number): Promise<Task> {
        return this.repository.findOne(id);
    }

    async update(data: Task): Promise<Task> {
        return await this.repository.save(data);
    }

    async remove(id: number): Promise<void> {
        await this.repository.delete(id);
    }

    async findByName(taskName: string): Promise<Task | undefined> {
        return this.repository.findOne(taskName);
    }

    async exits(taskName: string): Promise<boolean> {
        const count = await this.repository.count({ where: { taskName } });
        return count > 0;
    }
}
