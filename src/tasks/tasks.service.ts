import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityService } from '../crm/contact-activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { CLOSED_STATUSES, TaskStatus } from './enums/task-status.enum';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';

@Injectable()
export class TasksService {
  private readonly taskRepository: Repository<Task>;
  private readonly commentRepository: Repository<TaskComment>;
  private readonly attachmentRepository: Repository<TaskAttachment>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
    private readonly contactActivityService: ContactActivityService,
  ) {
    this.taskRepository = connection.getRepository(Task);
    this.commentRepository = connection.getRepository(TaskComment);
    this.attachmentRepository = connection.getRepository(TaskAttachment);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  async create(createdById: number, dto: CreateTaskDto): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();

    const task = this.taskRepository.create({
      tenant: { id: tenantId } as any,
      contact: { id: dto.contactId } as any,
      type: dto.type,
      title: dto.title ?? null,
      status: TaskStatus.TODO,
      assignedTo: dto.assignedToId ? ({ id: dto.assignedToId } as any) : null,
      createdBy: { id: createdById } as any,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    });

    const saved = await this.taskRepository.save(task);

    await this.contactActivityService.record({
      tenantId,
      contactId: dto.contactId,
      type: ContactActivityType.TASK_CREATED,
      summary: `${dto.type} task created`,
      occurredAt: new Date(),
      recordedById: createdById,
      referenceTable: 'task',
      referenceId: saved.id,
    });

    return saved;
  }

  async findAllForContact(contactId: number): Promise<Task[]> {
    const tenantId = this.tenantContext.requireTenant();
    return this.taskRepository.find({
      where: {
        tenant: { id: tenantId },
        contact: { id: contactId },
      },
      relations: ['comments', 'attachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    taskId: number,
    userId: number,
    dto: UpdateTaskStatusDto,
  ): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();

    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
      relations: ['contact'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    if (CLOSED_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already closed');
    }

    const contactId = task.contact.id;

    switch (dto.status) {
      case TaskStatus.ATTENDED_FELLOWSHIP:
      case TaskStatus.JOINED_SERVING_TEAM: {
        if (!dto.groupId || !dto.activityDate) {
          throw new BadRequestException(
            'groupId and activityDate are required for this status',
          );
        }

        const membership = this.membershipRepository.create({
          contact: { id: contactId } as any,
          group: { id: dto.groupId } as any,
          isActive: true,
        });
        const savedMembership = await this.membershipRepository.save(membership);

        await this.contactActivityService.record({
          tenantId,
          contactId,
          type:
            dto.status === TaskStatus.ATTENDED_FELLOWSHIP
              ? ContactActivityType.ATTENDED_FELLOWSHIP
              : ContactActivityType.JOINED_SERVING_TEAM,
          summary:
            dto.status === TaskStatus.ATTENDED_FELLOWSHIP
              ? 'Attended fellowship'
              : 'Joined serving team',
          occurredAt: new Date(dto.activityDate),
          recordedById: userId,
          referenceTable: 'group_membership',
          referenceId: savedMembership.id,
        });
        break;
      }

      case TaskStatus.MATCHED_TO_FELLOWSHIP: {
        await this.contactActivityService.record({
          tenantId,
          contactId,
          type: ContactActivityType.MATCHED_TO_FELLOWSHIP,
          summary: 'Matched to a fellowship',
          occurredAt: new Date(),
          recordedById: userId,
        });
        break;
      }

      case TaskStatus.GOT_BAPTISED: {
        if (!dto.baptismDate) {
          throw new BadRequestException(
            'baptismDate is required when status is GOT_BAPTISED',
          );
        }

        // TODO: Wire up EventAttendance once event tracking module is built

        const summaryParts = ['Got baptised'];
        if (dto.baptismLocation) summaryParts.push(`at ${dto.baptismLocation}`);
        if (dto.baptismOfficiant) summaryParts.push(`by ${dto.baptismOfficiant}`);

        await this.contactActivityService.record({
          tenantId,
          contactId,
          type: ContactActivityType.GOT_BAPTISED,
          summary: summaryParts.join(' '),
          occurredAt: new Date(dto.baptismDate),
          recordedById: userId,
          referenceTable: 'task',
          referenceId: task.id,
        });
        break;
      }

      case TaskStatus.DONE: {
        await this.contactActivityService.record({
          tenantId,
          contactId,
          type: ContactActivityType.TASK_COMPLETED,
          summary: `${task.type} task completed`,
          occurredAt: new Date(),
          recordedById: userId,
          referenceTable: 'task',
          referenceId: task.id,
        });
        break;
      }
    }

    task.status = dto.status;
    task.completedAt = new Date();
    return this.taskRepository.save(task);
  }

  async addComment(
    taskId: number,
    authorId: number,
    dto: AddCommentDto,
  ): Promise<TaskComment> {
    const tenantId = this.tenantContext.requireTenant();
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const comment = this.commentRepository.create({
      task: { id: taskId } as any,
      author: { id: authorId } as any,
      body: dto.body,
    });
    return this.commentRepository.save(comment);
  }

  async addAttachment(
    taskId: number,
    userId: number,
    url: string,
    label?: string,
  ): Promise<TaskAttachment> {
    const tenantId = this.tenantContext.requireTenant();
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const attachment = this.attachmentRepository.create({
      task: { id: taskId } as any,
      uploadedBy: { id: userId } as any,
      url,
      label: label ?? null,
    });
    return this.attachmentRepository.save(attachment);
  }

  async reassign(
    taskId: number,
    assignedToId: number,
    userId: number,
  ): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
      relations: ['contact'],
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    if (CLOSED_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already closed');
    }

    task.assignedTo = { id: assignedToId } as any;
    const saved = await this.taskRepository.save(task);

    await this.contactActivityService.record({
      tenantId,
      contactId: task.contact.id,
      type: ContactActivityType.TASK_ASSIGNED,
      summary: 'Task reassigned',
      occurredAt: new Date(),
      recordedById: userId,
      referenceTable: 'task',
      referenceId: task.id,
    });

    return saved;
  }
}
