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
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './enums/task-status.enum';
import { TaskType } from './enums/task-type.enum';

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

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string | string[],
    @Query('type') type?: string | string[],
    @Query('assignedToId') assignedToId?: string,
    @Query('locationGroupIds')
    locationGroupIds?: string | string[] | Record<string, string>,
  ) {
    const filters: {
      status?: TaskStatus[];
      type?: TaskType[];
      assignedToId?: number | 'unassigned';
      locationGroupIds?: number[];
    } = {};

    if (status) {
      filters.status = (
        Array.isArray(status) ? status : [status]
      ) as TaskStatus[];
    }
    if (type) {
      filters.type = (Array.isArray(type) ? type : [type]) as TaskType[];
    }
    if (assignedToId !== undefined) {
      filters.assignedToId =
        assignedToId === 'unassigned' ? 'unassigned' : Number(assignedToId);
    }
    if (locationGroupIds !== undefined) {
      const ids = TasksController.toNumberArray(locationGroupIds);
      if (ids.length) filters.locationGroupIds = ids;
    }

    return this.tasksService.findAll(Number(page), Number(limit), filters);
  }

  // qs (used by Express/Nest to parse query strings) only decodes repeated
  // keys (e.g. `?locationGroupIds=1&locationGroupIds=2...`) into an array up
  // to its default arrayLimit of 20 entries; beyond that it falls back to a
  // plain object keyed "0", "1", ... instead, so this must handle all shapes.
  private static toNumberArray(
    value: string | string[] | Record<string, string>,
  ) {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'object'
      ? Object.values(value)
      : [value];
    return values.map(Number).filter((id) => Number.isFinite(id));
  }

  @Get('contact/:contactId')
  async findAllForContact(@Param('contactId') contactId: number) {
    return this.tasksService.findAllForContact(contactId);
  }

  @Get('retention-report')
  async retentionReport(
    @Query('window') window: 'month' | 'week' | '90days' | 'ytd' = 'month',
    @Query('year') yearParam?: string,
  ) {
    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    if (window === 'month') {
      return this.retentionReportService.getMonthlyBreakdown(year);
    }

    if (window === 'week') {
      return this.retentionReportService.getWeeklyBreakdown(year);
    }

    let from: Date;
    switch (window) {
      case '90days':
        // Start of day 89 days ago gives a 90-day window (inclusive of today)
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
        break;
      case 'ytd':
      default:
        from = new Date(now.getFullYear(), 0, 1);
    }

    return this.retentionReportService.getSummary(from, now);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
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
    return this.tasksService.addAttachment(
      id,
      req.user.id,
      body.url,
      body.label,
    );
  }
}
