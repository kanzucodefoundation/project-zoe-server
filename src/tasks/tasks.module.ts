import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RetentionReportService } from './retention-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskComment, TaskAttachment, GroupMembership]),
  ],
  controllers: [TasksController],
  providers: [TasksService, RetentionReportService],
  exports: [TasksService],
})
export class TasksModule {}
