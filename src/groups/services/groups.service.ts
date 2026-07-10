import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  DataSource,
  TreeRepository,
  Not,
} from 'typeorm';
import Group from '../entities/group.entity';
import GroupEvent from '../../events/entities/event.entity';
import SearchDto from '../../shared/dto/search.dto';
import { GroupSearchDto } from '../dto/group-search.dto';
import GroupListDto from '../dto/group-list.dto';
import CreateGroupDto from '../dto/create-group.dto';
import UpdateGroupDto from '../dto/update-group.dto';
import { GroupDetailDto } from '../dto/group-detail.dto';
import GooglePlaceDto from '../../vendor/google-place.dto';
import { GoogleService } from '../../vendor/google.service';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import { hasValue } from '../../utils/validation';
import { endOfMonth, startOfMonth } from 'date-fns';
import { GroupPermissionsService } from './group-permissions.service';
import GroupCategory from '../entities/groupCategory.entity';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';
import { TenantContext } from 'src/shared/tenant/tenant-context';
import Phone from '../../crm/entities/phone.entity';
import { AfricasTalkingService } from '../../vendor/africas-talking.service';
import { GroupCategoryPurpose } from '../enums/groups';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { FellowshipSchedule } from '../../attendance/entities/fellowship-schedule.entity';

@Injectable()
export class GroupsService {
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly eventRepository: Repository<GroupEvent>;
  private readonly groupCategoryRepository: Repository<GroupCategory>;
  private readonly phoneRepository: Repository<Phone>;
  private readonly fellowshipScheduleRepository: Repository<FellowshipSchedule>;
  private readonly logger: ContextLogger;

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private groupsPermissionsService: GroupPermissionsService,
    private googleService: GoogleService,
    private appLogger: AppLogger,
    private tenantContext: TenantContext,
    private africasTalkingService: AfricasTalkingService,
  ) {
    this.repository = dataSource.getRepository(Group);
    this.treeRepository = dataSource.getTreeRepository(Group);
    this.membershipRepository = dataSource.getRepository(GroupMembership);
    this.eventRepository = dataSource.getRepository(GroupEvent);
    this.groupCategoryRepository = dataSource.getRepository(GroupCategory);
    this.phoneRepository = dataSource.getRepository(Phone);
    this.fellowshipScheduleRepository =
      dataSource.getRepository(FellowshipSchedule);
    this.logger = this.appLogger.createContextLogger('GroupsService');
  }

  private getSafeInValues<T>(values?: T[] | null): T[] | undefined {
    return Array.isArray(values) && values.length > 0 ? values : undefined;
  }

  async findAll(req: SearchDto, user?: any): Promise<any[]> {
    // Groups the user leads (directly or via an ancestor) or, for admins,
    // null meaning unrestricted. Mirrors GroupPermissionsService.hasPermissionForGroup.
    const accessibleGroupIds =
      await this.groupsPermissionsService.getAccessibleGroupIds(user);
    if (accessibleGroupIds !== null && accessibleGroupIds.length === 0) {
      return [];
    }

    if (req.purpose) {
      return this.findGroupsByPurpose(
        req.purpose as GroupCategoryPurpose,
        req.parentId,
        accessibleGroupIds,
      );
    }

    const safeAccessibleGroupIds = this.getSafeInValues(accessibleGroupIds);

    // If parentId is provided, filter by parent (for drill-down navigation)
    if (req.parentId !== undefined) {
      if (req.parentId === 'null' || req.parentId === '') {
        // Return root groups (no parent)
        return this.repository.find({
          where: safeAccessibleGroupIds
            ? [
                { id: In(safeAccessibleGroupIds), parentId: IsNull() },
                {
                  id: In(safeAccessibleGroupIds),
                  parentId: Not(In(safeAccessibleGroupIds)),
                },
              ]
            : { parentId: IsNull() },
          relations: { category: true, parent: true },
          order: { name: 'ASC' },
        });
      }

      const parentIdNum = parseInt(req.parentId);
      if (!isNaN(parentIdNum)) {
        // Return direct children of the specified group
        return this.repository.find({
          where: {
            parentId: parentIdNum,
            ...(safeAccessibleGroupIds
              ? { id: In(safeAccessibleGroupIds) }
              : {}),
          },
          relations: { category: true, parent: true },
          order: { name: 'ASC' },
        });
      }
    }

    // Default: return all groups as a tree structure
    // Manually build tree since findTrees() has issues with closure-table
    return this.buildGroupTree(accessibleGroupIds);
  }

  private async findGroupsByPurpose(
    purpose: GroupCategoryPurpose,
    parentId?: string,
    accessibleGroupIds?: number[] | null,
  ): Promise<Group[]> {
    const safeAccessibleGroupIds = this.getSafeInValues(accessibleGroupIds);
    const query = this.repository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.category', 'category')
      .leftJoinAndSelect('group.parent', 'parent')
      .where('category.purpose = :purpose', { purpose });

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        if (accessibleGroupIds) {
          // Treat as a root any accessible group whose parent isn't also
          // accessible (mirrors buildGroupTree's visible-root logic), not
          // just physical roots with no parent at all.
          query.andWhere(
            '(group.parentId IS NULL OR group.parentId NOT IN (:...rootParentIds))',
            {
              rootParentIds:
                accessibleGroupIds.length > 0 ? accessibleGroupIds : [-1],
            },
          );
        } else {
          query.andWhere('group.parentId IS NULL');
        }
      } else {
        const parentIdNum = parseInt(parentId, 10);
        if (!isNaN(parentIdNum)) {
          query.andWhere('group.parentId = :parentId', {
            parentId: parentIdNum,
          });
        }
      }
    }

    if (safeAccessibleGroupIds) {
      query.andWhere('group.id IN (:...accessibleGroupIds)', {
        accessibleGroupIds: safeAccessibleGroupIds,
      });
    }

    return query.orderBy('group.name', 'ASC').getMany();
  }

  private async buildGroupTree(
    accessibleGroupIds?: number[] | null,
  ): Promise<any[]> {
    const safeAccessibleGroupIds = this.getSafeInValues(accessibleGroupIds);

    // Fetch all groups flat
    const allGroups = await this.repository.find({
      relations: { category: true },
      order: { name: 'ASC' },
      ...(safeAccessibleGroupIds
        ? { where: { id: In(safeAccessibleGroupIds) } }
        : {}),
    });

    // Build a map for quick lookup
    const groupMap = new Map<number, any>();
    allGroups.forEach((group) => {
      groupMap.set(group.id, {
        id: group.id,
        privacy: group.privacy,
        name: group.name,
        details: group.details,
        metaData: group.metaData,
        parentId: group.parentId,
        address: group.address,
        categoryId: group.category?.id,
        children: [],
      });
    });

    // Build tree by linking children to parents
    const roots: any[] = [];
    allGroups.forEach((group) => {
      const node = groupMap.get(group.id);
      if (group.parentId === null || group.parentId === undefined) {
        roots.push(node);
      } else {
        const parent = groupMap.get(group.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found (orphan), treat as root
          roots.push(node);
        }
      }
    });

    return roots;
  }

  async getDrillDownGroups(
    parentId: number | null,
    categoryName?: string,
    user?: any,
  ): Promise<any> {
    // Get user's accessible groups
    const userGroupIds =
      await this.groupsPermissionsService.getUserGroupIds(user);

    // Build where clause
    const where: any = { parentId: parentId === null ? IsNull() : parentId };

    // Filter by category if specified
    if (categoryName) {
      const category = await this.groupCategoryRepository.findOne({
        where: { name: categoryName },
      });
      if (category) {
        where.category = { id: category.id };
      }
    }

    // Fetch groups
    const groups = await this.repository.find({
      where,
      relations: { category: true, parent: true },
      order: { name: 'ASC' },
    });

    // Filter by user permissions (only show groups user can access)
    const accessibleGroups = groups.filter((group) =>
      userGroupIds.includes(group.id),
    );

    // Enrich with counts
    const enrichedGroups = await Promise.all(
      accessibleGroups.map(async (group) => {
        const childCount = await this.getChildCount(group.id);
        const memberCount = await this.getMemberCount(group.id);

        return {
          ...this.toListView(group),
          childCount,
          memberCount,
          categoryName: group.category?.name,
        };
      }),
    );

    // Build response with breadcrumbs
    let parent = null;
    let breadcrumbs = [];

    if (parentId !== null) {
      parent = await this.repository.findOne({
        where: { id: parentId },
        relations: { category: true, parent: true },
      });

      if (parent) {
        breadcrumbs = await this.buildBreadcrumbs(parent);
      }
    }

    return {
      groups: enrichedGroups,
      parent: parent ? this.toListView(parent) : null,
      breadcrumbs,
      totalCount: enrichedGroups.length,
    };
  }

  private async getChildCount(groupId: number): Promise<number> {
    return this.repository.count({
      where: { parentId: groupId },
    });
  }

  private async getMemberCount(groupId: number): Promise<number> {
    return this.membershipRepository.count({
      where: {
        groupId,
        isActive: true,
      },
    });
  }

  private async buildBreadcrumbs(group: Group): Promise<any[]> {
    const breadcrumbs = [];
    let current: Group | null = group;

    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        name: current.name,
        categoryName: current.category?.name,
      });

      if (current.parentId) {
        current = await this.repository.findOne({
          where: { id: current.parentId },
          relations: { category: true },
        });
      } else {
        current = null;
      }
    }

    return breadcrumbs;
  }

  toListView(group: Group): GroupListDto {
    const { parent, category, id, name, details, parentId, privacy } = group;
    return {
      id,
      name,
      details,
      parentId,
      privacy,
      category: category
        ? {
            name: category.name,
            id: category.id,
            purpose: category.purpose ?? null,
          }
        : undefined,
      parent: parent ? { name: parent.name, id: parent.id } : undefined,
    } as GroupListDto;
  }

  toDetailView(group: Group): GroupDetailDto {
    const { parent, category, ...rest } = group;
    return {
      ...rest,
      category: category ? { name: category.name, id: category.id } : undefined,
      parent: parent ? { name: parent.name, id: parent.id } : undefined,
    } as GroupDetailDto;
  }

  toSimpleView(group: Group) {
    const { category, ...rest } = group;
    return {
      ...rest,
      category: category ? { name: category.name, id: category.id } : undefined,
    } as any;
  }

  async combo(req: GroupSearchDto, user: any): Promise<Group[]> {
    const findOps: Record<string, any> = {};

    if (hasValue(user)) {
      const groupIds =
        await this.groupsPermissionsService.getUserGroupIds(user);
      if (groupIds.length > 0) {
        findOps.id = In(groupIds);
      } else {
        // If user has no accessible groups, return empty array
        return [];
      }
    }

    if (hasValue(req.categories)) {
      const categoryIds: number[] = [];

      for (const categoryName of Array.isArray(req.categories)
        ? req.categories
        : [req.categories]) {
        const groupCategory = await this.groupCategoryRepository.findOne({
          where: { name: categoryName },
        });
        if (groupCategory) {
          categoryIds.push(groupCategory.id);
        }
      }

      if (categoryIds.length === 0) {
        return [];
      }

      findOps.category = { id: In(categoryIds) };
    }

    if (hasValue(req.query)) {
      findOps.name = ILike(`%${req.query}%`);
    }
    const data = await this.treeRepository.find({
      select: ['id', 'name', 'category', 'parent'],
      where: findOps,
      skip: req.skip,
      take: req.limit,
      cache: false,
    });

    return data;
  }

  async create(
    data: CreateGroupDto,
    user: any,
    seedingDatabase: boolean = false,
  ) {
    const tracking = this.logger.startTracking('createGroup', {
      userId: user?.id,
      contactId: user?.contactId,
    });

    try {
      const tenantId = seedingDatabase
        ? null
        : this.tenantContext.requireTenant();

      this.logger.business('log', 'Starting group creation', {
        operation: 'createGroup',
        userId: user?.id,
        contactId: user?.contactId,
        resource: 'group',
        metadata: {
          groupName: data.name,
          categoryName: data.categoryName,
          parentId: data.parentId,
          isSeeding: seedingDatabase,
          hasAddress: !!data.address?.placeId,
        },
      });

      let place: GooglePlaceDto | null = null;
      if (data.address?.placeId) {
        this.logger.business('debug', 'Fetching address details from Google', {
          operation: 'createGroup',
          userId: user?.id,
          metadata: { placeId: data.address.placeId },
        });
        place = await this.googleService.getPlaceDetails(data.address.placeId);
      }

      if (hasValue(data.parentId) && !seedingDatabase) {
        this.logger.security('log', 'Checking parent group permissions', {
          operation: 'createGroup',
          userId: user?.id,
          resourceId: data.parentId,
          resource: 'parent_group',
        });
        await this.groupsPermissionsService.assertPermissionForGroup(
          user,
          data.parentId as number,
        );
      }

      const newGroupCategory = await this.groupCategoryRepository.findOne({
        where: {
          name: data.categoryName,
          ...(tenantId ? { tenant: { id: tenantId } } : {}),
        },
        relations: { tenant: true },
      });

      if (!newGroupCategory) {
        this.logger.business('warn', 'Group category not found', {
          operation: 'createGroup',
          userId: user?.id,
          metadata: { categoryName: data.categoryName },
        });
      }

      const newGroup = new Group();
      newGroup.name = data.name;
      newGroup.privacy = data.privacy;
      newGroup.metaData = data.metaData;
      newGroup.tenant =
        newGroupCategory?.tenant || ({ id: tenantId } as Tenant);
      newGroup.category = newGroupCategory ?? undefined;
      newGroup.address = place ? (place as any) : undefined;
      newGroup.details = data.details;
      newGroup.parent = data.parentId
        ? ((await this.treeRepository.findOne({
            where: { id: data.parentId },
          })) as Group | null) ?? (null as any)
        : (null as any);

      const savedGroup = await this.treeRepository.save(newGroup);

      if (newGroupCategory?.purpose === GroupCategoryPurpose.FELLOWSHIP) {
        const tenantId =
          savedGroup.tenant?.id ?? (newGroupCategory?.tenant?.id as any);
        await this.fellowshipScheduleRepository.save(
          this.fellowshipScheduleRepository.create({
            tenant: { id: tenantId } as any,
            fellowshipGroup: { id: savedGroup.id } as any,
            fellowshipGroupId: savedGroup.id,
            meetingDay: 3,
            startTime: '19:00',
            frequency: 'weekly',
            isActive: true,
          }),
        );
      }

      this.logger.business('log', 'Group created successfully', {
        operation: 'createGroup',
        userId: user?.id,
        contactId: user?.contactId,
        resourceId: savedGroup.id,
        resource: 'group',
        metadata: {
          groupName: savedGroup.name,
          groupId: savedGroup.id,
          categoryName: data.categoryName,
          parentId: data.parentId,
        },
      });

      this.logger.endTracking(tracking, true);
      return savedGroup;
    } catch (error) {
      this.logger.error(error as Error, {
        operation: 'createGroup',
        userId: user?.id,
        metadata: {
          groupName: data.name,
          categoryName: data.categoryName,
        },
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async findOne(id: number, full = true, user: any = null) {
    const data = await this.repository.findOne({
      where: { id },
      relations: { category: true, parent: true },
    });
    if (!data) {
      return null;
    }

    await this.groupsPermissionsService.assertPermissionForGroup(user, id);

    this.logger.business('log', 'Group found successfully', {
      operation: 'findGroup',
      resourceId: id,
      resource: 'group',
      userId: user?.id,
      metadata: { loadFullDetails: full },
    });

    if (full) {
      this.logger.business('debug', 'Loading full group details', {
        operation: 'findGroup',
        resourceId: id,
        resource: 'group',
        userId: user?.id,
      });
      const groupData = this.toSimpleView(data);

      const parentIds: number[] = [];
      const visitedParentIds = new Set<number>();
      let currentParentId: number | null = data.parentId ? Number(data.parentId) : null;
      while (currentParentId !== null && !isNaN(currentParentId)) {
        if (visitedParentIds.has(currentParentId)) break;
        visitedParentIds.add(currentParentId);
        parentIds.push(currentParentId);
        const parentNode = await this.repository.findOne({
          where: { id: currentParentId },
          select: ['id', 'parentId'],
        });
        
        // Coerce the next lookup property into a clean primitive digit or null break flag
        currentParentId = parentNode?.parentId ? Number(parentNode.parentId) : null;
      }      groupData.parents = parentIds;
      const childGroupIds: number[] = [data.id];
      const pendingParentIds: number[] = [data.id];

      while (pendingParentIds.length > 0) {
        const currentParentId = pendingParentIds.shift();
        if (currentParentId === undefined) break;

        const children = await this.repository.find({
          where: { parentId: currentParentId },
          select: ['id'],
        });

        for (const child of children) {
          if (!childGroupIds.includes(child.id)) {
            childGroupIds.push(child.id);
            pendingParentIds.push(child.id);
          }
        }
      }

      groupData.children = childGroupIds;
      const safeChildGroupIds = this.getSafeInValues(childGroupIds);
      let totalAtt = 0;
      let totalMem = 0;

      if (safeChildGroupIds) {
        const filter = {
          groupId: In(childGroupIds),
          startDate: MoreThanOrEqual(startOfMonth(new Date())),
          endDate: LessThanOrEqual(endOfMonth(new Date())),
        };
        const events = await this.eventRepository.find({
          relations: { attendance: true, group: { members: true } },
          where: filter,
        });
        events.forEach((it) => {
          totalAtt += it.attendance?.length ?? 0;
          totalMem += it.group?.members?.length ?? 0;
        });
      }
      groupData.totalAttendance = totalAtt;
      groupData.percentageAttendance =
        totalMem > 0 ? ((100 * totalAtt) / totalMem).toFixed(2) : '0.00';

      const membership = await this.membershipRepository.find({
        where: { role: GroupRole.Leader, groupId: id },
        select: ['contactId'],
      });
      groupData.leaders = membership.map((it) => it.contactId);
      groupData.canEditGroup =
        await this.groupsPermissionsService.hasPermissionForGroup(user, id);
      groupData.reports = childGroupIds
        ? await this.eventRepository.find({
            relations: { category: true, attendance: true },
            where: { groupId: In(childGroupIds) },
            select: ['id', 'name', 'startDate'],
          })
        : [];

      return groupData;
    }
    return this.toListView(data);
  }

  async update(
    dto: UpdateGroupDto,
    user: any,
  ): Promise<GroupListDto | GroupDetailDto | any> {
    this.logger.business('log', 'Starting group update', {
      operation: 'updateGroup',
      resourceId: dto.id,
      resource: 'group',
      userId: user?.id,
      metadata: { groupName: dto.name },
    });

    await this.groupsPermissionsService.assertPermissionForGroup(user, dto.id);

    const currGroup = await this.repository
      .createQueryBuilder()
      .where('id = :id', { id: dto.id })
      .getOne();

    if (!currGroup)
      throw new ClientFriendlyException(`Invalid group ID:${dto.id}`);
    let place: GooglePlaceDto | null | undefined;
    if (dto.address && dto.address.placeId !== currGroup.address?.placeId) {
      this.logger.business('debug', 'Fetching new address coordinates', {
        operation: 'updateGroup',
        resourceId: dto.id,
        userId: user?.id,
        metadata: { placeId: dto.address.placeId },
      });
      place = await this.googleService.getPlaceDetails(dto.address.placeId);
    } else {
      place = currGroup.address;
      this.logger.business('debug', 'Using existing address coordinates', {
        operation: 'updateGroup',
        resourceId: dto.id,
        userId: user?.id,
      });
    }

    let parentGroup: Group | undefined;
    if (hasValue(dto.parentId)) {
      parentGroup = (await this.treeRepository.findOne({
        where: { id: dto.parentId },
      })) ?? undefined;
    }
    let category = currGroup.category;
    if (hasValue(dto.categoryId)) {
      category = (await this.groupCategoryRepository.findOne({
        where: {
          id: dto.categoryId,
        },
      })) ?? undefined;
    }
    if (hasValue(dto.categoryName)) {
      category = (await this.groupCategoryRepository.findOne({
        where: {
          name: dto.categoryName,
        },
      })) ?? undefined;
    }

    const result = await this.repository
      .createQueryBuilder()
      .update(Group)
      .set({
        name: dto.name,
        parent: parentGroup,
        details: dto.details,
        privacy: dto.privacy,
        category: category,
        address: place,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (result.affected)
      this.logger.business('log', 'Group update completed successfully', {
        operation: 'updateGroup',
        resourceId: dto.id,
        resource: 'group',
        userId: user?.id,
        metadata: {
          affected: result.affected,
          groupName: dto.name,
        },
      });
    return await this.findOne(dto.id, true, user);
  }

  async remove(id: number, user: any): Promise<void> {
    await this.groupsPermissionsService.assertPermissionForGroup(user, id);
    await this.treeRepository.delete(id);
  }

  async exits(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { name } });
    return count > 0;
  }

  async count(): Promise<number> {
    return await this.repository.count();
  }

  async getGroupsByCategory(categoryName: string): Promise<Group[]> {
    return this.repository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.category', 'category')
      .where('category.name = :categoryName', { categoryName })
      .getMany();
  }

  async getMyGroups(user: any): Promise<GroupListDto[]> {
    // Get groups that the user has access to based on their role/permissions
    const groupIds =
      await this.groupsPermissionsService.getUserIsMemberLeaderGroupIds(user);
    if (groupIds.length === 0) {
      return [];
    }

    const groups = await this.repository.find({
      where: { id: In(groupIds) },
      relations: { category: true, parent: true },
    });

    // Fetch children for each group
    const groupsWithChildren: GroupListDto[] = [];

    for (const group of groups) {
      const groupDto = this.toListView(group);

      // Fetch direct children of this group
      const children = await this.repository.find({
        where: { parentId: group.id },
        relations: { category: true, parent: true },
      });

      // Add the group itself
      groupsWithChildren.push(groupDto);

      // Add children as separate items (flattened for dropdown use)
      for (const child of children) {
        groupsWithChildren.push(this.toListView(child));
      }
    }

    // Remove duplicates (in case a child is also in user's direct groups)
    const uniqueGroups = groupsWithChildren.filter(
      (group, index, self) =>
        index === self.findIndex((g) => g.id === group.id),
    );

    return uniqueGroups;
  }

  async getCategories(): Promise<any[]> {
    const categories = await this.groupCategoryRepository.find({
      select: ['id', 'name'],
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));
  }

  async getGroupMembers(
    groupId: number,
    user: any,
    limit = 50,
    offset = 0,
  ): Promise<any> {
    const hasPermission =
      await this.groupsPermissionsService.hasPermissionForGroup(user, groupId);
    if (!hasPermission) {
      throw new ClientFriendlyException('Access denied to this group');
    }

    const numericGroupId = Number(groupId);
    const numericLimit = Number(limit) || 50;
    const numericOffset = Number(offset) || 0;

    const memberships = await this.membershipRepository.createQueryBuilder('membership')
      .leftJoinAndSelect('membership.contact', 'contact')
      .leftJoinAndSelect('contact.person', 'person')
      .leftJoinAndSelect('contact.emails', 'emails')
      .where('membership.groupId = :groupId', { groupId: numericGroupId })
      .skip(numericOffset) 
      .take(numericLimit)
      .getMany();

    const members = memberships.map((membership) => {
      const firstName = membership.contact?.person?.firstName ?? '';
      const lastName = membership.contact?.person?.lastName ?? '';
      const fullName = (firstName || lastName)
        ? `${firstName} ${lastName}`.trim()
        : (membership.contact?.emails?.[0]?.value ?? 'Unknown Member');

      return {
        id: membership.contact?.id,
        fullName,
        role: membership.role,
        joinedAt: membership.joinedAt,
      };
    });

    const total = await this.membershipRepository.count({ where: { groupId: numericGroupId } });

    return {
      members,
      total,
      limit: numericLimit,
      offset: numericOffset,
    };  }

  async getPublicLocations(): Promise<{ fobs: any[] }> {
    this.logger.business('log', 'Fetching public locations for signup', {
      operation: 'getPublicLocations',
      resource: 'groups',
    });

    // Get tenant ID from context
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business(
      'debug',
      'Tenant context resolved for public locations',
      {
        operation: 'getPublicLocations',
        resource: 'groups',
        metadata: { tenantId },
      },
    );

    // Get the Location category
    const locationCategory = await this.groupCategoryRepository.findOne({
      where: { name: 'Location', tenant: { id: tenantId } },
    });

    if (!locationCategory) {
      this.logger.business('warn', 'Location category not found for tenant', {
        operation: 'getPublicLocations',
        resource: 'groups',
        metadata: { tenantId },
      });
      return { fobs: [] };
    }

    // Get all location groups with their parent FOBs, filtered by tenant
    const locations = await this.repository.find({
      where: {
        category: { id: locationCategory.id },
        tenant: { id: tenantId },
      },
      relations: { parent: true },
      select: ['id', 'name', 'parent'],
      order: { name: 'ASC' },
    });

    this.logger.business('debug', 'Locations fetched from database', {
      operation: 'getPublicLocations',
      resource: 'groups',
      metadata: { locationCount: locations.length },
    });

    // Group by FOB (parent name)
    const fobMap = new Map<string, any[]>();

    locations.forEach((location) => {
      const fobName = location.parent?.name || 'Uncategorized';
      const bucket = fobMap.get(fobName) ?? [];

      if (!fobMap.has(fobName)) {
        fobMap.set(fobName, bucket);
      }

      bucket.push({
        id: location.id,
        name: location.name,
      });
    });

    // Convert to array format and sort FOBs alphabetically
    const fobs = Array.from(fobMap.entries())
      .map(([fobName, locations]) => ({
        name: fobName,
        locations: locations.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.logger.business(
      'log',
      'Public locations grouped by FOB successfully',
      {
        operation: 'getPublicLocations',
        resource: 'groups',
        metadata: {
          tenantId: this.tenantContext.tenantId,
          fobCount: fobs.length,
          totalLocations: locations.length,
        },
      },
    );

    return { fobs };
  }

  /**
   * Get SMS info for a group - returns member counts and phone availability.
   */
  async getGroupSmsInfo(groupId: number, user: any): Promise<any> {
    // Check if user has permission to view this group
    const hasPermission =
      await this.groupsPermissionsService.hasPermissionForGroup(user, groupId);
    if (!hasPermission) {
      throw new ClientFriendlyException('Access denied to this group');
    }

    // Get all active memberships for the group
    const memberships = await this.membershipRepository.find({
      where: { groupId, isActive: true },
      relations: { contact: { phones: true } },
    });

    const totalMembers = memberships.length;
    let membersWithPhone = 0;
    let membersWithoutPhone = 0;

    for (const membership of memberships) {
      const phones = membership.contact?.phones || [];
      if (phones.length > 0) {
        membersWithPhone++;
      } else {
        membersWithoutPhone++;
      }
    }

    return {
      totalMembers,
      membersWithPhone,
      membersWithoutPhone,
    };
  }

  /**
   * Send SMS to all group members with phone numbers using Africa's Talking.
   *
   * TODO: ASYNC IMPLEMENTATION NEEDED FOR PRODUCTION
   * This is currently synchronous and will timeout for large groups.
   * MUST BE CHANGED to async job queue (e.g., Bull, BullMQ, or similar).
   *
   * Recommended flow:
   * 1. Validate request and queue job immediately
   * 2. Return job ID to frontend: { jobId: "abc123", status: "queued" }
   * 3. Process sends in background worker
   * 4. Frontend polls /api/sms-jobs/:jobId for status
   * 5. Show progress/completion via polling or websocket
   *
   * This prevents:
   * - Request timeouts on large groups
   * - Blocking the API server
   * - Poor user experience waiting for sends to complete
   */
  async sendGroupSms(
    groupId: number,
    message: string,
    user: any,
  ): Promise<any> {
    // Validate group exists
    const group = await this.repository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    // Check if user has permission
    const hasPermission =
      await this.groupsPermissionsService.hasPermissionForGroup(user, groupId);
    if (!hasPermission) {
      throw new BadRequestException('Access denied to this group');
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Get all active members with phone numbers
    const memberships = await this.membershipRepository.find({
      where: { groupId, isActive: true },
      relations: { contact: { phones: true, person: true } },
    });

    if (memberships.length === 0) {
      throw new BadRequestException('Group has no active members');
    }

    // Extract and validate phone numbers
    const validPhones: string[] = [];
    let skippedCount = 0;

    for (const membership of memberships) {
      const phones = membership.contact?.phones || [];
      const primaryPhone = phones.find((p) => p.isPrimary) || phones[0];

      if (primaryPhone) {
        const normalized = this.africasTalkingService.normalizePhoneNumber(
          primaryPhone.value,
        );
        if (normalized) {
          validPhones.push(normalized);
        } else {
          skippedCount++;
          this.logger.business('debug', 'Skipped invalid phone number', {
            operation: 'sendGroupSms',
            metadata: {
              phone: primaryPhone.value,
              contactId: membership.contactId,
            },
          });
        }
      } else {
        skippedCount++;
      }
    }

    // Check if we have any valid numbers
    if (validPhones.length === 0) {
      throw new BadRequestException(
        'No valid phone numbers found in group members',
      );
    }

    this.logger.business('log', 'Sending SMS to group members', {
      operation: 'sendGroupSms',
      resource: 'groups',
      resourceId: groupId,
      userId: user?.id,
      metadata: {
        groupName: group?.name,
        messageLength: message.length,
        totalMembers: memberships.length,
        validPhones: validPhones.length,
        skippedCount,
      },
    });

    // Send SMS via Africa's Talking
    let result;
    try {
      result = await this.africasTalkingService.sendBulkSms(
        validPhones,
        message,
      );
    } catch (error) {
      this.logger.error(error as Error, {
        operation: 'sendGroupSms',
        resource: 'groups',
        resourceId: groupId,
      });
      throw new InternalServerErrorException(
        'Failed to send SMS. Please try again later.',
      );
    }

    this.logger.business('log', 'SMS send completed', {
      operation: 'sendGroupSms',
      resource: 'groups',
      resourceId: groupId,
      userId: user?.id,
      metadata: {
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalAttempted: validPhones.length,
      },
    });

    // Return response in specified format
    return {
      success: result.success,
      sentCount: result.sentCount,
      totalMembers: memberships.length,
      skippedCount: skippedCount + result.failedCount,
    };
  }
}
