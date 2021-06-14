import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Connection,
  FindConditions,
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
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
import GroupCategoryReport from '../entities/groupCategoryReport.entity';
import { endOfMonth, startOfMonth } from 'date-fns';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly repository: Repository<Group>,
    @InjectRepository(Group)
    private readonly treeRepository: TreeRepository<Group>,
    private readonly connection: Connection,
    @InjectRepository(GroupMembership)
    private readonly membershipRepository: Repository<GroupMembership>,
    @InjectRepository(GroupCategoryReport)
    private readonly groupReportRepository: Repository<GroupCategoryReport>,
    private googleService: GoogleService,
    @InjectRepository(GroupEvent)
    private readonly eventRepository: Repository<GroupEvent>,
  ) {}

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

  async combo(req: GroupSearchDto): Promise<Group[]> {
    console.log('GroupSearchDto', req);
    const findOps: FindConditions<Group> = {};
    if (hasValue(req.categories)) {
      findOps.categoryId = In(req.categories);
    }
    if (hasValue(req.query)) {
      findOps.name = ILike(`%${req.query}%`);
    }
    console.log('findOps', findOps);
    return await this.treeRepository.find({
      select: ['id', 'name', 'categoryId', 'parent'],
      where: findOps,
      skip: req.skip,
      take: req.limit,
      cache: true,
    });
  }

  async create(data: CreateGroupDto) {
    Logger.log(`Create.Group starting ${data.name}`);
    let place: GooglePlaceDto = null;
    if (data.address?.placeId) {
      place = await this.googleService.getPlaceDetails(data.address.placeId);
    }

    const toSave = new Group();
    toSave.name = data.name;
    toSave.privacy = data.privacy;
    toSave.metaData = data.metaData;
    toSave.categoryId = data.categoryId;
    toSave.address = place;
    toSave.details = data.details;
    toSave.parent = data.parentId
      ? await this.treeRepository.findOne(data.parentId)
      : null;
    const result = await this.treeRepository.save(toSave);

    return this.findOne(result.id, true);
  }

  async findOne(id: number, full = true) {
    const data = await this.treeRepository.findOne(id, {
      relations: ['category', 'parent'],
    });
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

      groupData.reports = await this.eventRepository.find({
        relations: ['category', 'attendance'],
        where: {groupId: In(groupData.children)},
        select: ['id', 'name', 'startDate'],
      });
    
      return groupData;
    }
    return this.toListView(data);
  }

  async update(
    dto: UpdateGroupDto,
  ): Promise<GroupListDto | GroupDetailDto | any> {
    Logger.log(`Update.Group groupID:${dto.id} starting`);

    const currGroup = await this.repository
      .createQueryBuilder()
      .where('id = :id', { id: dto.id })
      .getOne();

    if (!currGroup)
      throw new ClientFriendlyException(`Invalid group ID:${dto.id}`);
    let place: GooglePlaceDto = null;
    if (dto.address && dto.address.placeId !== currGroup.address?.placeId) {
      Logger.log(`Update.Group groupID:${dto.id} fetching coordinates`);
      place = await this.googleService.getPlaceDetails(dto.address.placeId);
    } else {
      place = currGroup.address;
      Logger.log(`Update.Group groupID:${dto.id} using old coordinates`);
    }

    let parentGroup = null;
    if (hasValue(dto.parentId)) {
      parentGroup = await this.treeRepository.findOne(dto.parentId);
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
        categoryId: dto.categoryId,
        address: place,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (result.affected)
      Logger.log(
        `Update.Group groupID:${dto.id} affected:${result.affected} complete`,
      );
    return await this.findOne(dto.id, true);
  }

  async remove(id: number): Promise<void> {
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
