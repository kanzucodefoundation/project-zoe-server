import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Connection, In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityService } from '../crm/contact-activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { CLOSED_STATUSES, TaskStatus } from './enums/task-status.enum';
import { TaskType } from './enums/task-type.enum';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';
import { GroupCategoryNames } from '../groups/enums/groups';

const TASK_SUMMARY_RELATIONS = [
  'contact',
  'contact.person',
  'assignedTo',
  'assignedTo.contact',
  'assignedTo.contact.person',
  'createdBy',
  'createdBy.contact',
  'createdBy.contact.person',
];

const TASK_DETAIL_RELATIONS = [
  ...TASK_SUMMARY_RELATIONS,
  'comments',
  'comments.author',
  'comments.author.contact',
  'comments.author.contact.person',
  'attachments',
];

@Injectable()
export class TasksService {
  private readonly taskRepository: Repository<Task>;
  private readonly commentRepository: Repository<TaskComment>;
  private readonly attachmentRepository: Repository<TaskAttachment>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly groupRepository: Repository<Group>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
    private readonly contactActivityService: ContactActivityService,
  ) {
    this.taskRepository = connection.getRepository(Task);
    this.commentRepository = connection.getRepository(TaskComment);
    this.attachmentRepository = connection.getRepository(TaskAttachment);
    this.membershipRepository = connection.getRepository(GroupMembership);
    this.groupRepository = connection.getRepository(Group);
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

    return this.findTaskWithRelations(saved.id, tenantId);
  }

  async findAll(
    page = 1,
    limit = 20,
    filters: {
      status?: TaskStatus[];
      type?: TaskType[];
      assignedToId?: number | 'unassigned';
    } = {},
  ): Promise<{ data: Task[]; total: number }> {
    const tenantId = this.tenantContext.requireTenant();

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.contact', 'contact')
      .leftJoinAndSelect('contact.person', 'contactPerson')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('assignedTo.contact', 'assignedToContact')
      .leftJoinAndSelect('assignedToContact.person', 'assignedToContactPerson')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.contact', 'createdByContact')
      .leftJoinAndSelect('createdByContact.person', 'createdByContactPerson')
      .where('task.tenantId = :tenantId', { tenantId })
      .orderBy('task.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status?.length) {
      qb.andWhere('task.status IN (:...statuses)', {
        statuses: filters.status,
      });
    }

    if (filters.type?.length) {
      qb.andWhere('task.type IN (:...types)', { types: filters.type });
    }

    if (filters.assignedToId === 'unassigned') {
      qb.andWhere('task.assignedToId IS NULL');
    } else if (filters.assignedToId !== undefined) {
      qb.andWhere('task.assignedToId = :assignedToId', {
        assignedToId: filters.assignedToId,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    if (data.length > 0) {
      const taskIds = data.map((t) => t.id);

      const rows = await this.commentRepository
        .createQueryBuilder('tc')
        .select('MAX(tc.id)', 'maxId')
        .where('tc.task IN (:...taskIds)', { taskIds })
        .groupBy('tc.task')
        .getRawMany<{ maxId: string }>();

      const maxIds = rows.map((r) => Number(r.maxId)).filter(Boolean);

      if (maxIds.length > 0) {
        const comments = await this.commentRepository.find({
          where: { id: In(maxIds) },
          relations: [
            'task',
            'author',
            'author.contact',
            'author.contact.person',
          ],
        });
        const commentMap = new Map(comments.map((c) => [c.task.id, c]));
        data.forEach((task) => {
          task.latestComment = commentMap.get(task.id) ?? null;
        });
      } else {
        data.forEach((task) => {
          task.latestComment = null;
        });
      }
    }

    data.forEach((task) => this.sanitizeTaskUsers(task));
    return { data, total };
  }

  async findAllForContact(contactId: number): Promise<Task[]> {
    const tenantId = this.tenantContext.requireTenant();
    const tasks = await this.taskRepository.find({
      where: {
        tenant: { id: tenantId },
        contact: { id: contactId },
      },
      relations: [...TASK_DETAIL_RELATIONS],
      order: { createdAt: 'DESC' },
    });

    tasks.forEach((task) => this.sanitizeTaskUsers(task));
    return tasks;
  }

  async findOne(taskId: number): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();
    return this.findTaskWithRelations(taskId, tenantId);
  }

  async update(
    taskId: number,
    dto: import('./dto/update-task.dto').UpdateTaskDto,
  ): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.assignedToId !== undefined) {
      task.assignedTo = dto.assignedToId
        ? ({ id: dto.assignedToId } as any)
        : null;
    }
    if (dto.dueAt !== undefined) {
      task.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    }

    await this.taskRepository.save(task);
    return this.findTaskWithRelations(taskId, tenantId);
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

        const savedMembership =
          dto.status === TaskStatus.ATTENDED_FELLOWSHIP
            ? await this.ensureCategoryMembership(
                contactId,
                dto.groupId,
                GroupCategoryNames.MC,
              )
            : await this.ensureCategoryMembership(
                contactId,
                dto.groupId,
                GroupCategoryNames.GARAGE_TEAM,
                true,
              );

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
        if (dto.baptismOfficiant)
          summaryParts.push(`by ${dto.baptismOfficiant}`);

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
    await this.taskRepository.save(task);
    return this.findTaskWithRelations(taskId, tenantId);
  }

  private async findTaskWithRelations(
    taskId: number,
    tenantId: number,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenant: { id: tenantId } },
      relations: [...TASK_DETAIL_RELATIONS],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    this.sanitizeTaskUsers(task);
    return task;
  }

  private sanitizeTaskUsers(task: Task): void {
    this.sanitizeUser(task.assignedTo);
    this.sanitizeUser(task.createdBy);
    task.comments?.forEach((comment) => this.sanitizeUser(comment.author));
  }

  private sanitizeUser(user?: { password?: string } | null): void {
    if (!user) return;
    delete user.password;
  }

  private async ensureCategoryMembership(
    contactId: number,
    groupId: number,
    categoryName: GroupCategoryNames,
    enforceSingleActiveMembership = false,
  ): Promise<GroupMembership> {
    const tenantId = this.tenantContext.requireTenant();
    const group = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.category', 'category')
      .where('group.id = :groupId', { groupId })
      .andWhere('group.tenantId = :tenantId', { tenantId })
      .andWhere('category.name = :categoryName', { categoryName })
      .getOne();

    if (!group) {
      throw new BadRequestException(
        `Selected group is not a valid ${categoryName} option`,
      );
    }

    const categoryMemberships = await this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.group', 'group')
      .leftJoinAndSelect('group.category', 'category')
      .where('membership.contactId = :contactId', { contactId })
      .andWhere('category.name = :categoryName', { categoryName })
      .orderBy('membership.id', 'DESC')
      .getMany();

    const activeMemberships = categoryMemberships.filter(
      (membership) => membership.isActive !== false,
    );
    const activeTargetMembership = activeMemberships.find(
      (membership) => membership.groupId === group.id,
    );

    if (enforceSingleActiveMembership) {
      const membershipsToDeactivate = activeMemberships
        .filter((membership) => membership.groupId !== group.id)
        .map((membership) => membership.id);

      if (membershipsToDeactivate.length > 0) {
        await this.membershipRepository
          .createQueryBuilder()
          .update(GroupMembership)
          .set({
            isActive: false,
            leftAt: () => 'CURRENT_TIMESTAMP',
          })
          .where('id IN (:...ids)', { ids: membershipsToDeactivate })
          .execute();
      }
    }

    if (activeTargetMembership) {
      return activeTargetMembership;
    }

    const inactiveTargetMembership = categoryMemberships.find(
      (membership) =>
        membership.groupId === group.id && membership.isActive === false,
    );

    if (inactiveTargetMembership) {
      await this.membershipRepository
        .createQueryBuilder()
        .update(GroupMembership)
        .set({
          isActive: true,
          leftAt: null,
          joinedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id', { id: inactiveTargetMembership.id })
        .execute();

      return this.membershipRepository.findOneOrFail({
        where: { id: inactiveTargetMembership.id },
      });
    }

    const membership = this.membershipRepository.create({
      contact: { id: contactId } as any,
      group: { id: group.id } as any,
      isActive: true,
    });
    return this.membershipRepository.save(membership);
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

    return this.findTaskWithRelations(saved.id, tenantId);
  }
}
