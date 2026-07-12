import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Connection, EntityManager, In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityService } from '../crm/contact-activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { CLOSED_STATUSES, TaskStatus } from './enums/task-status.enum';
import { TaskType } from './enums/task-type.enum';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';
import { GroupCategoryPurpose } from '../groups/enums/groups';

const TASK_SUMMARY_RELATIONS = [
  'contact',
  'contact.person',
  'contact.addresses',
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

type TaskLocationGroup = {
  id: number;
  name: string;
};

type TaskWithLocationGroup = Task & {
  locationGroup: TaskLocationGroup | null;
};

type TaskLocationGroupPayload = {
  locationGroup: TaskLocationGroup | null;
  tasks: TaskWithLocationGroup[];
};

type TaskListPayload = {
  data: TaskWithLocationGroup[];
  groups: TaskLocationGroupPayload[];
  total: number;
};

@Injectable()
export class TasksService {
  private readonly connection: Connection;
  private readonly taskRepository: Repository<Task>;
  private readonly commentRepository: Repository<TaskComment>;
  private readonly attachmentRepository: Repository<TaskAttachment>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly groupRepository: Repository<Group>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
    private readonly contactActivityService: ContactActivityService,
    private readonly groupPermissionsService: GroupPermissionsService,
  ) {
    this.connection = connection;
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
      locationGroupIds?: number[];
    } = {},
    user?: any,
  ): Promise<TaskListPayload> {
    const tenantId = this.tenantContext.requireTenant();

    const accessibleLocationGroupIds =
      await this.resolveAccessibleLocationGroupIds(user);
    if (accessibleLocationGroupIds !== null) {
      const requestedLocationGroupIds = filters.locationGroupIds?.length
        ? new Set(filters.locationGroupIds)
        : null;
      const effectiveLocationGroupIds = requestedLocationGroupIds
        ? accessibleLocationGroupIds.filter((id) =>
            requestedLocationGroupIds.has(id),
          )
        : accessibleLocationGroupIds;

      if (effectiveLocationGroupIds.length === 0) {
        return { data: [], groups: [], total: 0 };
      }
      filters = { ...filters, locationGroupIds: effectiveLocationGroupIds };
    }

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.contact', 'contact')
      .leftJoinAndSelect('contact.person', 'contactPerson')
      .leftJoinAndSelect('contact.addresses', 'contactAddresses')
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

    if (filters.locationGroupIds?.length) {
      qb.andWhere((sub) => {
        const sq = sub
          .subQuery()
          .select('1')
          .from(GroupMembership, 'gm')
          .where('gm.contactId = task.contactId')
          .andWhere('gm.groupId IN (:...locationGroupIds)', {
            locationGroupIds: filters.locationGroupIds,
          })
          .andWhere('gm.isActive = true')
          .getQuery();
        return `EXISTS ${sq}`;
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

    const tasksWithLocationGroups = await this.attachLocationGroups(
      data,
      tenantId,
    );

    tasksWithLocationGroups.forEach((task) => {
      this.sanitizeTaskUsers(task);
      this.attachContactAddress(task);
    });
    return {
      data: tasksWithLocationGroups,
      groups: this.groupTasksByLocation(tasksWithLocationGroups),
      total,
    };
  }

  async findAllForContact(contactId: number, user?: any): Promise<Task[]> {
    const tenantId = this.tenantContext.requireTenant();
    await this.assertContactLocationAccess(contactId, user);
    const tasks = await this.taskRepository.find({
      where: {
        tenant: { id: tenantId },
        contact: { id: contactId },
      },
      relations: [...TASK_DETAIL_RELATIONS],
      order: { createdAt: 'DESC' },
    });

    tasks.forEach((task) => {
      this.sanitizeTaskUsers(task);
      this.attachContactAddress(task);
    });
    return tasks;
  }

  async findOne(taskId: number, user?: any): Promise<Task> {
    const tenantId = this.tenantContext.requireTenant();
    const task = await this.findTaskWithRelations(taskId, tenantId);
    await this.assertContactLocationAccess(task.contact.id, user);
    return task;
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

    // Validate inputs that would throw before opening the transaction
    if (
      (dto.status === TaskStatus.ATTENDED_FELLOWSHIP ||
        dto.status === TaskStatus.JOINED_SERVING_TEAM) &&
      (!dto.groupId || !dto.activityDate)
    ) {
      throw new BadRequestException(
        'groupId and activityDate are required for this status',
      );
    }
    if (dto.status === TaskStatus.GOT_BAPTISED && !dto.baptismDate) {
      throw new BadRequestException(
        'baptismDate is required when status is GOT_BAPTISED',
      );
    }

    // Side effects that must happen before the transaction (membership writes
    // use class-bound repos; making them transactional is a separate refactor)
    let membershipId: number | undefined;
    if (
      dto.status === TaskStatus.ATTENDED_FELLOWSHIP ||
      dto.status === TaskStatus.JOINED_SERVING_TEAM
    ) {
      const savedMembership =
        dto.status === TaskStatus.ATTENDED_FELLOWSHIP
          ? await this.ensureCategoryMembership(
              contactId,
              dto.groupId,
              GroupCategoryPurpose.FELLOWSHIP,
            )
          : await this.ensureCategoryMembership(
              contactId,
              dto.groupId,
              GroupCategoryPurpose.SERVING_TEAM,
              true,
            );
      membershipId = savedMembership.id;
    }

    // contact_activity insert and task status update are atomic
    await this.connection.transaction(async (em: EntityManager) => {
      switch (dto.status) {
        case TaskStatus.ATTENDED_FELLOWSHIP:
        case TaskStatus.JOINED_SERVING_TEAM: {
          await this.contactActivityService.record(
            {
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
              referenceId: membershipId,
            },
            em,
          );
          break;
        }

        case TaskStatus.MATCHED_TO_FELLOWSHIP: {
          await this.contactActivityService.record(
            {
              tenantId,
              contactId,
              type: ContactActivityType.MATCHED_TO_FELLOWSHIP,
              summary: 'Matched to a fellowship',
              occurredAt: new Date(),
              recordedById: userId,
            },
            em,
          );
          break;
        }

        case TaskStatus.GOT_BAPTISED: {
          // TODO: Wire up EventAttendance once event tracking module is built
          const summaryParts = ['Got baptised'];
          if (dto.baptismLocation)
            summaryParts.push(`at ${dto.baptismLocation}`);
          if (dto.baptismOfficiant)
            summaryParts.push(`by ${dto.baptismOfficiant}`);

          await this.contactActivityService.record(
            {
              tenantId,
              contactId,
              type: ContactActivityType.GOT_BAPTISED,
              summary: summaryParts.join(' '),
              occurredAt: new Date(dto.baptismDate),
              recordedById: userId,
              referenceTable: 'task',
              referenceId: task.id,
            },
            em,
          );
          break;
        }

        case TaskStatus.DONE: {
          await this.contactActivityService.record(
            {
              tenantId,
              contactId,
              type: ContactActivityType.TASK_COMPLETED,
              summary: `${task.type} task completed`,
              occurredAt: new Date(),
              recordedById: userId,
              referenceTable: 'task',
              referenceId: task.id,
            },
            em,
          );
          break;
        }

        case TaskStatus.UNREACHABLE: {
          await this.contactActivityService.record(
            {
              tenantId,
              contactId,
              type: ContactActivityType.UNREACHABLE,
              summary: `${task.type} task marked as unreachable`,
              occurredAt: new Date(),
              recordedById: userId,
              referenceTable: 'task',
              referenceId: task.id,
            },
            em,
          );
          break;
        }
      }

      task.status = dto.status;
      task.completedAt = new Date();
      await em.save(task);
    });

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
    this.attachContactAddress(task);
    return task;
  }

  private sanitizeTaskUsers(task: Task): void {
    this.sanitizeUser(task.assignedTo);
    this.sanitizeUser(task.createdBy);
    task.comments?.forEach((comment) => this.sanitizeUser(comment.author));

    const createdBy = task.createdBy as
      | (Task['createdBy'] & { contact?: unknown })
      | null;
    if (createdBy?.contact) {
      delete createdBy.contact;
    }
  }

  private sanitizeUser(user?: { password?: string } | null): void {
    if (!user) return;
    delete user.password;
  }

  private attachContactAddress(task: Task): void {
    const contact = task.contact as
      | (Task['contact'] & { address?: string | null })
      | undefined;
    if (!contact) return;
    contact.address = contact.addresses?.[0]?.freeForm ?? null;
    delete contact.addresses;
  }

  // Returns the location-purpose group ids the user may view tasks for, or
  // null when the user is unrestricted (admin) and should see every location.
  // A leader's accessible groups already expand to include all descendants
  // (see GroupPermissionsService.getUserGroupIds), so a leader of a
  // structure group above location (FOB/region/network/movement) naturally
  // resolves to every location beneath it, while a location leader resolves
  // to just their own location.
  private async resolveAccessibleLocationGroupIds(
    user: any,
  ): Promise<number[] | null> {
    const accessibleGroupIds =
      await this.groupPermissionsService.getAccessibleGroupIds(user);
    if (accessibleGroupIds === null) {
      return null;
    }
    if (accessibleGroupIds.length === 0) {
      return [];
    }

    const tenantId = this.tenantContext.requireTenant();
    const locationGroups = await this.groupRepository
      .createQueryBuilder('group')
      .innerJoin('group.category', 'category')
      .where('group.id IN (:...groupIds)', { groupIds: accessibleGroupIds })
      .andWhere('group.tenantId = :tenantId', { tenantId })
      .andWhere('category.purpose = :purpose', {
        purpose: GroupCategoryPurpose.LOCATION,
      })
      .select(['group.id'])
      .getMany();

    return locationGroups.map((group) => group.id);
  }

  private async assertContactLocationAccess(
    contactId: number,
    user: any,
  ): Promise<void> {
    const accessibleLocationGroupIds =
      await this.resolveAccessibleLocationGroupIds(user);
    if (accessibleLocationGroupIds === null) {
      return;
    }

    const hasAccess = accessibleLocationGroupIds.length
      ? await this.membershipRepository
          .createQueryBuilder('gm')
          .where('gm.contactId = :contactId', { contactId })
          .andWhere('gm.groupId IN (:...groupIds)', {
            groupIds: accessibleLocationGroupIds,
          })
          .andWhere('gm.isActive = true')
          .getCount()
      : 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this task');
    }
  }

  private async attachLocationGroups(
    tasks: Task[],
    tenantId: number,
  ): Promise<TaskWithLocationGroup[]> {
    const contactIds = [
      ...new Set(
        tasks
          .map((task) => task.contact?.id)
          .filter((contactId): contactId is number => contactId !== undefined),
      ),
    ];

    if (contactIds.length === 0) {
      return tasks.map((task) => {
        const taskWithLocationGroup = task as TaskWithLocationGroup;
        taskWithLocationGroup.locationGroup = null;
        return taskWithLocationGroup;
      });
    }

    const memberships = await this.membershipRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.group', 'group')
      .innerJoinAndSelect('group.category', 'category')
      .where('membership.contactId IN (:...contactIds)', { contactIds })
      .andWhere('membership.isActive = true')
      .andWhere('group.tenantId = :tenantId', { tenantId })
      .andWhere('category.purpose = :categoryPurpose', {
        categoryPurpose: GroupCategoryPurpose.LOCATION,
      })
      .orderBy('membership.id', 'DESC')
      .getMany();

    const locationByContactId = new Map<number, TaskLocationGroup>();

    memberships.forEach((membership) => {
      if (locationByContactId.has(membership.contactId)) return;
      locationByContactId.set(membership.contactId, {
        id: membership.group.id,
        name: membership.group.name,
      });
    });

    return tasks.map((task) => {
      const taskWithLocationGroup = task as TaskWithLocationGroup;
      taskWithLocationGroup.locationGroup =
        locationByContactId.get(task.contact?.id) ?? null;
      return taskWithLocationGroup;
    });
  }

  private groupTasksByLocation(
    tasks: TaskWithLocationGroup[],
  ): TaskLocationGroupPayload[] {
    const groups = new Map<string, TaskLocationGroupPayload>();

    tasks.forEach((task) => {
      const locationGroup = task.locationGroup;
      const key = locationGroup ? String(locationGroup.id) : 'ungrouped';
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.tasks.push(task);
        return;
      }

      groups.set(key, {
        locationGroup,
        tasks: [task],
      });
    });

    return [...groups.values()];
  }

  private async ensureCategoryMembership(
    contactId: number,
    groupId: number,
    categoryPurpose: GroupCategoryPurpose,
    enforceSingleActiveMembership = false,
  ): Promise<GroupMembership> {
    const tenantId = this.tenantContext.requireTenant();
    const group = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.category', 'category')
      .where('group.id = :groupId', { groupId })
      .andWhere('group.tenantId = :tenantId', { tenantId })
      .andWhere('category.purpose = :categoryPurpose', { categoryPurpose })
      .getOne();

    if (!group) {
      throw new BadRequestException(
        `Selected group is not a valid ${categoryPurpose} group`,
      );
    }

    const categoryMemberships = await this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.group', 'group')
      .leftJoinAndSelect('group.category', 'category')
      .where('membership.contactId = :contactId', { contactId })
      .andWhere('category.purpose = :categoryPurpose', { categoryPurpose })
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
