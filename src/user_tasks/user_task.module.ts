import { Module } from '@nestjs/common';
import { UserTaskController } from './controllers/user_task.controller';
import { UserTaskService } from './user_task.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTask } from './entities/user_task.entity';


@Module({
    imports: [TypeOrmModule.forFeature([UserTask])],
    providers: [UserTaskService],
    controllers: [
        UserTaskController,
    ],
    exports: [UserTaskService],
})
export class UserTaskModule {
}

