import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  Connection,
  TreeRepository,
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

@Injectable()
export class GroupsService {
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly eventRepository: Repository<GroupEvent>;
  private readonly groupCategoryRepository: Repository<GroupCategory>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private groupsPermissionsService: GroupPermissionsService,
    private googleService: GoogleService,
    private appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(Group);
    this.treeRepository = connection.getTreeRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
    this.eventRepository = connection.getRepository(GroupEvent);
    this.groupCategoryRepository = connection.getRepository(GroupCategory);
    this.logger = this.appLogger.createContextLogger('GroupsService');
  }

  async findAll(req: SearchDto): Promise<any[]> {
    return await this.treeRepository.findTrees();
  }

  toListView(group: Group): GroupListDto {
    const { parent, category, id, name, details, parentId, privacy } = group;
    return {
      id,
      name,
      details,
      parentId,
      privacy,
      category: category ? { name: category.name, id: category.id } : null,
      parent: parent ? { name: parent.name, id: parent.id } : null,
    };
  }

  toDetailView(group: Group): GroupDetailDto {
    const { parent, category, ...rest } = group;
    return {
      ...rest,
      category: { name: category.name, id: category.id },
      parent: parent ? { name: parent.name, id: parent.id } : null,
    } as any;
  }

  toSimpleView(group: Group) {
    const { category, ...rest } = group;
    return {
      ...rest,
      category: category ? { name: category.name, id: category.id } : null,
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
      const categoryIds = [];

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

      let place: GooglePlaceDto = null;
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
          data.parentId,
        );
      }

      const newGroupCategory = await this.groupCategoryRepository.findOne({
        where: {
          name: data.categoryName,
        },
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
      newGroup.category = newGroupCategory;
      newGroup.address = place;
      newGroup.details = data.details;
      newGroup.parent = data.parentId
        ? await this.treeRepository.findOne({ where: { id: data.parentId } })
        : null;

      const savedGroup = await this.treeRepository.save(newGroup);

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
      this.logger.error(error, {
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
    const data = await this.treeRepository.findOne({
      where: { id },
      relations: ['category', 'parent'],
    });
    if (!data) {
      return null;
    }
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

      const ancestors = await this.treeRepository.findAncestors(data);
      groupData.parents = ancestors.map((it) => it.id);

      const descendants = await this.treeRepository.findDescendants(data);
      groupData.children = descendants.map((it) => it.id);

      const filter = {
        groupId: In(groupData.children),
        startDate: MoreThanOrEqual(startOfMonth(new Date())),
        endDate: LessThanOrEqual(endOfMonth(new Date())),
      };
      let totalAtt = 0,
        totalMem = 0;
      await (
        await this.eventRepository.find({
          relations: ['attendance', 'group', 'group.members'],
          where: filter,
        })
      ).forEach((it) => {
        totalAtt += it.attendance.length;
        totalMem += it.group.members.length;
      });
      groupData.totalAttendance = totalAtt;
      groupData.percentageAttendance = ((100 * totalAtt) / totalMem).toFixed(2);

      const membership = await this.membershipRepository.find({
        where: { role: GroupRole.Leader, groupId: id },
        select: ['contactId'],
      });
      groupData.leaders = membership.map((it) => it.contactId);
      groupData.canEditGroup =
        await this.groupsPermissionsService.hasPermissionForGroup(user, id);
      groupData.reports = await this.eventRepository.find({
        relations: ['category', 'attendance'],
        where: { groupId: In(groupData.children) },
        select: ['id', 'name', 'startDate'],
      });

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
    let place: GooglePlaceDto;
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

    let parentGroup = null;
    if (hasValue(dto.parentId)) {
      parentGroup = await this.treeRepository.findOne({
        where: { id: dto.parentId },
      });
    }
    let category = currGroup.category;
    if (hasValue(dto.categoryId)) {
      category = await this.groupCategoryRepository.findOne({
        where: {
          id: dto.categoryId,
        },
      });
    }
    if (hasValue(dto.categoryName)) {
      category = await this.groupCategoryRepository.findOne({
        where: {
          name: dto.categoryName,
        },
      });
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
    return await this.findOne(dto.id, true);
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
    const groupIds = await this.groupsPermissionsService.getUserGroupIds(user);

    if (groupIds.length === 0) {
      return [];
    }

    const groups = await this.repository.find({
      where: { id: In(groupIds) },
      relations: ['category', 'parent'],
    });

    return groups.map((group) => this.toListView(group));
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
    // Check if user has permission to view this group
    const hasPermission =
      await this.groupsPermissionsService.hasPermissionForGroup(user, groupId);
    if (!hasPermission) {
      throw new ClientFriendlyException('Access denied to this group');
    }

    const memberships = await this.membershipRepository.find({
      where: { groupId },
      relations: ['contact'],
      skip: offset,
      take: limit,
    });

    const members = memberships.map((membership) => ({
      id: membership.contact.id,
      fullName:
        membership.contact?.person?.firstName +
        ' ' +
        (membership.contact?.person?.lastName || ''),
      role: membership.role,
      joinedAt: new Date(), // GroupMembership doesn't have createdAt
    }));

    const total = await this.membershipRepository.count({ where: { groupId } });

    return {
      members,
      total,
      limit,
      offset,
    };
  }
}
