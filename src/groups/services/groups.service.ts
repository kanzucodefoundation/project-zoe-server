import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository, ILike, TreeRepository } from 'typeorm';
import Group from '../entities/group.entity';
import SearchDto from '../../shared/dto/search.dto';
import { GroupSearchDto } from '../dto/group-search.dto';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { hasValue } from '../../utils/basicHelpers';
import GroupListDto from '../dto/group-list.dto';
import CreateGroupDto from '../dto/create-group.dto';
import UpdateGroupDto from '../dto/update-group.dto';
import { GroupDetailDto } from '../dto/group-detail.dto';
import GooglePlaceDto from '../../vendor/google-place.dto';
import { GoogleService } from '../../vendor/google.service';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import { EventsService } from 'src/events/events.service';
import GroupEventSearchDto from 'src/events/dto/group-event-search.dto';
import { isThisMonth, lastDayOfMonth, startOfMonth } from 'date-fns';
import GroupEventDto from 'src/events/dto/group-event.dto';
import ComboDto from 'src/shared/dto/combo.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly repository: Repository<Group>,
    @InjectRepository(Group)
    private readonly treeRepository: TreeRepository<Group>,
    @InjectRepository(GroupMembership)
    private readonly membershipRepository: Repository<GroupMembership>,
    private googleService: GoogleService,
    private eventService: EventsService,
  ) {}

  async findAll(req: SearchDto): Promise<any[]> {
    const data = await this.repository.find({
      relations: ['category', 'parent'],
      skip: req.skip,
      take: req.limit,
    });
    return data.map(this.toListView);
  }

  toListView(group: Group): GroupListDto {
    const {
      parent,
      category,
      id,
      categoryId,
      name,
      details,
      parentId,
      privacy,
    } = group;
    return {
      id,
      categoryId,
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

  toSimpleGroupView(group: Group): ComboDto {
    return {
      id: group.id,
      name: group.name,
    }
  }

  async combo(req: GroupSearchDto): Promise<Group[]> {
    const findOps: FindConditions<Group> = {};
    if (hasValue(req.categories)) {
      findOps.categoryId = In(req.categories);
    }
    if (hasValue(req.query)) {
      findOps.name = ILike(`%${req.query}%`);
    }
    return await this.repository.find({
      select: ['id', 'name', 'categoryId', 'parentId'],
      where: findOps,
      skip: req.skip,
      take: req.limit,
      cache: true,
    });
  }

  async create(data: CreateGroupDto): Promise<GroupListDto | GroupDetailDto> {
    Logger.log(`Create.Group starting ${data.name}`);
    let place: GooglePlaceDto = null;
    if (data.address?.placeId) {
      place = await this.googleService.getPlaceDetails(data.address.placeId);
    }

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        id: 0,
        ...data,
        address: place,
        children: [],
        members: [],
      })
      .execute();
    const insertedId = result.identifiers[0]['id'];
    Logger.log(`Create.Group success name: ${data.name} id:${insertedId}`);

    return this.findOne(insertedId, true);
  }

  async findOne(id: number, full = true): Promise<GroupListDto | GroupDetailDto> {
    const data = await this.repository.findOne(id, {
      relations: ['category', 'parent'],
    });
    Logger.log(`Read.Group success id:${id}`);
    if (full) {
      Logger.log(`Read.Group loading full scope id:${id}`);
      const groupData = this.toDetailView(data);
      const membership = await this.membershipRepository.find({
        where: { role: GroupRole.Leader, groupId: id },
        select: ['contactId'],
      });
      const children = await this.repository.find({
        where: {parentId: id},
      })
      
      groupData.leaders = membership.map(it => it.contactId);
  
      const d = groupData.children = children.length > 0 ? children.map(this.toSimpleGroupView) : [this.toSimpleGroupView(data)];

      const childEvents: GroupEventDto[] = []
      let totalAtt = 0;
      let sumAtt = 0;
      let count = 0;
      
      for(let i = 0; i < d.length; i++) {
        const req: GroupEventSearchDto = {
          groupId: d[i].id, 
          limit: 100, 
          skip: 0
        }
        const events = await this.eventService.findAll(req);
        events.map((e: any) => {
          childEvents.push(e);
          if (isThisMonth(e.startDate)) {
            totalAtt += e.totalAttendance;
            if (Number(e.attendancePercentage) >= 0) {
              sumAtt += Number(e.attendancePercentage);
              count++;
            }
          }
        })
      }

      groupData.totalAttendance = totalAtt;
      groupData.averageAttendance = (sumAtt / count).toFixed(2);
      groupData.childEvents = childEvents;

      return groupData;
    }
    return this.toListView(data);
  }

  async update(dto: UpdateGroupDto): Promise<GroupListDto | GroupDetailDto> {
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
    const result = await this.repository
      .createQueryBuilder()
      .update(Group)
      .set({
        name: dto.name,
        parentId: dto.parentId,
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
    await this.repository.delete(id);
  }

  async exits(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { name } });
    return count > 0;
  }

  async count(): Promise<number> {
    return await this.repository.count();
  }
}
