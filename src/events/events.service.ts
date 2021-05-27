import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindConditions,
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { GoogleService } from '../vendor/google.service';
import GooglePlaceDto from '../vendor/google-place.dto';
import ClientFriendlyException from '../shared/exceptions/client-friendly.exception';
import GroupEvent from './entities/event.entity';
import EventCategory from './entities/eventCategory.entity';
import GroupEventDto from './dto/group-event.dto';
import CreateEventDto from './dto/create-event.dto';
import InternalAddress from '../shared/entity/InternalAddress';
import GroupEventSearchDto from './dto/group-event-search.dto';
import { getArray, hasValue } from 'src/utils/validation';
import { UserDto } from '../auth/dto/user.dto';
import EventMetricsDto from './dto/event-metrics-search.dto';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import GroupReportDto from './dto/group-report.dto';
import Group from 'src/groups/entities/group.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(GroupEvent)
    private readonly repository: Repository<GroupEvent>,
    @InjectRepository(EventCategory)
    private readonly categoryRepository: Repository<EventCategory>,
    @InjectRepository(GroupMembership)
    private readonly groupRepository: Repository<Group>,
    private googleService: GoogleService,
  ) {}

  async findAll(
    req: GroupEventSearchDto,
    user: UserDto,
  ): Promise<GroupEventDto[]> {
    const filter: FindConditions<GroupEvent> = {};

    // TODO use user object to filter reports
    if (hasValue(req.categoryIdList))
      filter.categoryId = In(getArray(req.categoryIdList));
    if (hasValue(req.groupIdList))
      filter.groupId = In(getArray(req.groupIdList));
    if (hasValue(req.parentIdList))
      filter.parentId = In(getArray(req.parentIdList));
    if (hasValue(req.from)) {
      filter.startDate = MoreThanOrEqual(req.from);
    }
    if (hasValue(req.to)) {
      filter.endDate = LessThanOrEqual(req.to);
    }
    if (hasValue(req.query)) {
      filter.name = ILike(`%${req.query.trim().toLowerCase()}%`);
    }

    const data = await this.repository.find({
      relations: ['category', 'group', 'attendance', 'submittedBy'],
      skip: req.skip,
      take: req.limit,
      where: filter,
    });
    return data.map(this.toDto);
  }

  async findUnsubmitted(req: GroupEventSearchDto): Promise<GroupReportDto[]> {
    const filter: FindConditions<Group> = {};
    if (hasValue(req.query)) {
      filter.name = ILike(`%${req.query.trim().toLowerCase()}%`);
    }

    const unsubmitted = await this.groupRepository
      .createQueryBuilder()
      .leftJoinAndSelect(
        (subQuery) => {
          return subQuery
            .select(['*'])
            .from('group_membership', 'group_membership')
            .where('"group_membership"."role" =:role', { role: 'Leader' });
        },
        'gm',
        '"gm"."groupId"  = "Group"."id"',
      )
      .leftJoinAndSelect(
        (subQuery) => {
          return subQuery
            .select([
              '"person"."contactId", "person"."firstName","person"."middleName","person"."lastName"',
            ])
            .from('person', 'person');
        },
        'person',
        '"person"."contactId" = "gm"."contactId"',
      )
      .leftJoinAndSelect(
        'group_report',
        'group_report',
        '"group_report"."groupId" = "Group"."id"',
      )
      .leftJoinAndSelect(
        (subQuery) => {
          return subQuery
            .select([
              '"events"."name", "events"."startDate", "events"."endDate", "events"."groupId", "events"."categoryId"',
            ])
            .from('events', 'events')
            .where(
              '"events"."startDate" >= :from AND "events"."endDate" <= :to',
              { from: req.from, to: req.to },
            );
        },
        'events',
        '"events"."groupId" = "group_report"."groupId" AND "events"."categoryId" = "group_report"."eventCategoryId"',
      )
      .where(filter)
      .skip(req.skip)
      .take(req.limit)
      .getRawMany();

    const newList: GroupReportDto[] = unsubmitted.map((item, index) => ({
      id: index,
      groupLeader: {
        fullName:
          item.firstName === null
            ? 'No Group Leader'
            : `${item.firstName} ${item.middleName && item.middleName} ${
                item.lastName
              }`.replace(/\s+/g, ' '),
        role: item.role ? item.role : 'No Role Found',
      },
      frequency: item.group_report_frequency,
      eventCategoryId:
        item.group_report_eventCategoryId.charAt(0).toUpperCase() +
        item.group_report_eventCategoryId.slice(1),
      group: {
        id: item.Group_id,
        name: item.Group_name,
        parentId: item.Group_parentId,
        category: item.Group_categoryId,
      },
    }));
    return newList;
  }

  async loadMetrics(req: EventMetricsDto, user: UserDto): Promise<any> {
    const filter: FindConditions<GroupEvent> = {};

    // TODO use user object to filter reports
    if (hasValue(req.categoryIdList))
      filter.categoryId = In(req.categoryIdList);
    if (hasValue(req.groupIdList)) filter.id = In(req.groupIdList);

    if (hasValue(req.from)) {
      filter.startDate = MoreThanOrEqual(req.from);
    }
    if (hasValue(req.to)) {
      filter.endDate = LessThanOrEqual(req.to);
    }

    const data = await this.repository.find({
      select: ['name', 'categoryId', 'metaData', 'id'],
      relations: ['category', 'group', 'group.members', 'attendance'],
      where: filter,
    });
    return data.map((it) => {
      const { group, attendance, ...rest } = it;
      let attendancePercentage = 0;
      if (group.members.length) {
        attendancePercentage = (100 * attendance.length) / group.members.length;
      }
      return {
        ...rest,
        members: group.members.length,
        attendance: attendance.length,
        attendancePercentage,
      };
    });
  }

  toDto(data: GroupEvent): GroupEventDto {
    const { group, attendance, submittedBy, ...rest } = data;
    return {
      ...rest,
      submittedBy: {
        firstName: submittedBy.firstName,
        middleName: submittedBy.middleName,
        lastName: submittedBy.lastName,
      },
      group: {
        id: group.id,
        name: group.name,
        parentId: group.parentId,
        members: group.members,
      },
      attendance: attendance,
    };
  }

  toListView(event: GroupEvent): GroupEventDto {
    const { group, ...rest } = event;
    return {
      ...rest,
      group: {
        id: group.id,
        name: group.name,
        parentId: group.parentId,
        members: [],
      },
    };
  }

  toDetailView(event: GroupEvent): GroupEventDto {
    const { group, category, ...rest } = event;
    return {
      ...rest,
      group: {
        id: group.id,
        name: group.name,
        parentId: group.parentId,
        members: [],
      },
      category: category ? { id: category.id, name: category.name } : null,
      categoryFields: category.fields,
    };
  }

  async create(data: CreateEventDto): Promise<GroupEventDto> {
    Logger.log(`Create.Event starting ${data.name}`);
    let place: GooglePlaceDto = null;
    if (data.venue.placeId) {
      place = await this.googleService.getPlaceDetails(data.venue.placeId);
    }

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        id: 0,
        ...data,
        venue: place,
        attendance: [],
      })
      .execute();
    const insertedId = result.identifiers[0]['id'];
    Logger.log(`Create.Event success name: ${data.name} id:${insertedId}`);

    return this.findOne(insertedId, true);
  }

  async findOne(id: number, full = true): Promise<GroupEventDto> {
    const data = await this.repository.findOne(id, {
      relations: ['category', 'group', 'category.fields'],
    });
    Logger.log(`Read.Event success id:${id}`);
    if (full) {
      Logger.log(`Read.Event loading full scope id:${id}`);

      return this.toDetailView(data);
    }
    return this.toListView(data);
  }

  async update(dto: GroupEventDto): Promise<GroupEventDto> {
    Logger.log(`Update.Event eventId:${dto.id} starting`);
    const currGroup = await this.repository
      .createQueryBuilder()
      .where('id = :id', { id: dto.id })
      .getOne();

    if (!currGroup)
      throw new ClientFriendlyException(`Invalid group ID:${dto.id}`);
    let place: InternalAddress;
    if (dto.venue && dto.venue.placeId !== currGroup.venue?.placeId) {
      Logger.log(`Update.Event eventId:${dto.id} fetching coordinates`);
      place = {
        ...(await this.googleService.getPlaceDetails(dto.venue.placeId)),
      };
    } else {
      place = {
        ...currGroup.venue,
      };
      Logger.log(`Update.Event eventId:${dto.id} using old coordinates`);
    }
    const result = await this.repository
      .createQueryBuilder()
      .update(GroupEvent)
      .set({
        ...dto,
        venue: place,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (result.affected)
      Logger.log(
        `Update.Event eventId:${dto.id} affected:${result.affected} complete`,
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
