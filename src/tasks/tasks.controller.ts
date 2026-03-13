import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TasksService } from './tasks.service';
import { RetentionReportService } from './retention-report.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Tasks')
@Controller('api/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly retentionReportService: RetentionReportService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @Request() req: any) {
    return this.tasksService.create(req.user.id, dto);
  }

  @Get('contact/:contactId')
  async findAllForContact(@Param('contactId') contactId: number) {
    return this.tasksService.findAllForContact(contactId);
  }

  @Get('retention-report')
  async retentionReport(
    @Query('window') window: 'month' | '90days' | 'ytd' = 'month',
  ) {
    const now = new Date();
    let from: Date;

    switch (window) {
      case '90days':
        from = new Date(now);
        from.setDate(from.getDate() - 90);
        break;
      case 'ytd':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return this.retentionReportService.getSummary(from, now);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: number,
    @Body() dto: UpdateTaskStatusDto,
    @Request() req: any,
  ) {
    return this.tasksService.updateStatus(id, req.user.id, dto);
  }

  @Patch(':id/assign')
  async reassign(
    @Param('id') id: number,
    @Body() dto: ReassignTaskDto,
    @Request() req: any,
  ) {
    return this.tasksService.reassign(id, dto.assignedToId, req.user.id);
  }

  @Post(':id/comments')
  async addComment(
    @Param('id') id: number,
    @Body() dto: AddCommentDto,
    @Request() req: any,
  ) {
    return this.tasksService.addComment(id, req.user.id, dto);
  }

  @Post(':id/attachments')
  async addAttachment(
    @Param('id') id: number,
    @Body() body: { url: string; label?: string },
    @Request() req: any,
  ) {
    return this.tasksService.addAttachment(id, req.user.id, body.url, body.label);
  }
}
