import { Injectable, Logger, Inject } from "@nestjs/common";
import {
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  Connection,
  TreeRepository,
} from "typeorm";
import Group from "../entities/group.entity";
import GroupEvent from "../../events/entities/event.entity";
import SearchDto from "../../shared/dto/search.dto";
import { GroupSearchDto } from "../dto/group-search.dto";
import GroupListDto from "../dto/group-list.dto";
import CreateGroupDto from "../dto/create-group.dto";
import UpdateGroupDto from "../dto/update-group.dto";
import { GroupDetailDto } from "../dto/group-detail.dto";
import GooglePlaceDto from "../../vendor/google-place.dto";
import { GoogleService } from "../../vendor/google.service";
import ClientFriendlyException from "../../shared/exceptions/client-friendly.exception";
import GroupMembership from "../entities/groupMembership.entity";
import { GroupRole } from "../enums/groupRole";
import { hasValue } from "../../utils/validation";
import { endOfMonth, startOfMonth } from "date-fns";
import { GroupPermissionsService } from "./group-permissions.service";
import GroupCategory from "../entities/groupCategory.entity";

@Injectable()
export class GroupsService {
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly eventRepository: Repository<GroupEvent>;
  private readonly groupCategoryRepository: Repository<GroupCategory>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private groupsPermissionsService: GroupPermissionsService,
    private googleService: GoogleService,
  ) {
    this.repository = connection.getRepository(Group);
    this.treeRepository = connection.getTreeRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
    this.eventRepository = connection.getRepository(GroupEvent);
    this.groupCategoryRepository = connection.getRepository(GroupCategory);
  }

  async findAll(req: SearchDto): Promise<any[]> {
    console.log(req);
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
      category: { name: category.name, id: category.id },
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
      category: { name: category.name, id: category.id },
    } as any;
  }

  async combo(req: GroupSearchDto, user: any): Promise<Group[]> {
    const findOps: Record<string, any> = {};

    if (hasValue(user)) {
      const groupIds =
        await this.groupsPermissionsService.getUserGroupIds(user);
      findOps.id = In(groupIds);
    }

    if (hasValue(req.categories)) {
      const categoryIds = [];

      for (const categoryName of Array.isArray(req.categories)
        ? req.categories
        : [req.categories]) {
        const groupCategory = await this.groupCategoryRepository.findOne({
          where: { name: categoryName },
        });
        categoryIds.push(groupCategory.id);
      }

      findOps.category = { id: In(categoryIds) };
    }

    if (hasValue(req.query)) {
      findOps.name = ILike(`%${req.query}%`);
    }

    console.log("findOps", findOps);

    const data = await this.treeRepository.find({
      select: ["id", "name", "category", "parent"],
      where: findOps,
      skip: req.skip,
      take: req.limit,
      cache: true,
    });

    return data;
  }

  async create(
    data: CreateGroupDto,
    user: any,
    seedingDatabase: boolean = false,
  ) {
    Logger.log(`Create.Group starting ${data.name}`);
    let place: GooglePlaceDto = null;
    if (data.address?.placeId) {
      place = await this.googleService.getPlaceDetails(data.address.placeId);
    }

    if (hasValue(data.parentId) && !seedingDatabase) {
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

    return await this.treeRepository.save(newGroup);
  }

  async findOne(id: number, full = true, user: any = null) {
    const data = await this.treeRepository.findOne({
      where: { id },
      relations: ["category", "parent"],
    });
    if (!data) {
      return null;
    }
    Logger.log(`Read.Group success id:${id}`);
    if (full) {
      Logger.log(`Read.Group loading full scope id:${id}`);
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
          relations: ["attendance", "group", "group.members"],
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
        select: ["contactId"],
      });
      groupData.leaders = membership.map((it) => it.contactId);
      groupData.canEditGroup =
        await this.groupsPermissionsService.hasPermissionForGroup(user, id);
      groupData.reports = await this.eventRepository.find({
        relations: ["category", "attendance"],
        where: { groupId: In(groupData.children) },
        select: ["id", "name", "startDate"],
      });

      return groupData;
    }
    return this.toListView(data);
  }

  async update(
    dto: UpdateGroupDto,
    user: any,
  ): Promise<GroupListDto | GroupDetailDto | any> {
    Logger.log(`Update.Group groupID:${dto.id} starting`);

    await this.groupsPermissionsService.assertPermissionForGroup(user, dto.id);

    const currGroup = await this.repository
      .createQueryBuilder()
      .where("id = :id", { id: dto.id })
      .getOne();

    if (!currGroup)
      throw new ClientFriendlyException(`Invalid group ID:${dto.id}`);
    let place: GooglePlaceDto;
    if (dto.address && dto.address.placeId !== currGroup.address?.placeId) {
      Logger.log(`Update.Group groupID:${dto.id} fetching coordinates`);
      place = await this.googleService.getPlaceDetails(dto.address.placeId);
    } else {
      place = currGroup.address;
      Logger.log(`Update.Group groupID:${dto.id} using old coordinates`);
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

    console.log(`Update.Group Id:${dto.parentId} parentGroup: `, parentGroup);
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
      .where("id = :id", { id: dto.id })
      .execute();
    if (result.affected)
      Logger.log(
        `Update.Group groupID:${dto.id} affected:${result.affected} complete`,
      );
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
}
