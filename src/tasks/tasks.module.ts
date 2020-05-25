import { Module } from '@nestjs/common';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Task])],
    providers: [TasksService],
    controllers: [
        TasksController,
    ],
    exports: [TasksService],
})
export class TasksModule {
}
