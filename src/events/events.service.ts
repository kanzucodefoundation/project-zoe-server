import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  Connection,
} from 'typeorm';
import { GoogleService } from '../vendor/google.service';
import GooglePlaceDto from '../vendor/google-place.dto';
import ClientFriendlyException from '../shared/exceptions/client-friendly.exception';
import GroupEvent from './entities/event.entity';
import EventCategory from './entities/eventCategory.entity';
import GroupEventDto from './dto/group-event.dto';
import CreateEventDto from './dto/create-event.dto';
import InternalAddress from '../shared/entity/InternalAddress';
import { getArray, hasValue, removeDuplicates } from 'src/utils/validation';
import { UserDto } from '../auth/dto/user.dto';
import EventMetricsDto from './dto/event-metrics-search.dto';
import Group from 'src/groups/entities/group.entity';
import { isDate } from 'lodash';
import GroupEventSearchDto from './dto/group-event-search.dto';
import GroupMembership from 'src/groups/entities/groupMembership.entity';

@Injectable()
export class EventsService {
  private readonly repository: Repository<GroupEvent>;
  private readonly categoryRepository: Repository<EventCategory>;
  private readonly groupRepository: Repository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private googleService: GoogleService,
  ) {
    this.repository = connection.getRepository(GroupEvent);
    this.categoryRepository = connection.getRepository(EventCategory);
    this.groupRepository = connection.getRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  async findAll(
    req: GroupEventSearchDto,
    user: UserDto,
  ): Promise<GroupEventDto[]> {
    const filter: Record<string, any> = {};
    let descendants = [];

    const membership = await this.membershipRepository.findOne({
      where: { contactId: user.contactId },
      relations: ['group'],
    });

    if (membership?.group) {
      const descendantIds = await this.getDescendantIds(membership.group.id);
      descendants = Array.from(
        new Set([membership.group.id, ...descendantIds]),
      );
    }

    if (hasValue(req.groupIdList)) {
      filter.groupId = In(getArray(req.groupIdList));
    } else {
      filter.groupId = In(getArray(descendants));
    }

    if (hasValue(req.categoryIdList)) {
      filter.category = In(getArray(req.categoryIdList));
    }

    if (hasValue(req.parentIdList)) {
      filter.parentId = In(getArray(req.parentIdList));
    }

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

  async loadMetrics(req: EventMetricsDto, user: UserDto): Promise<any> {
    const filter: Record<string, any> = {};

    // TODO: Use user object to filter reports

    if (hasValue(req.groupIdList)) {
      const parents = await this.groupRepository.find({
        where: { id: In(getArray(req.groupIdList)) },
      });

      const _children = await Promise.all(
        parents.map(async (parent) => {
          const descendantIds = await this.getDescendantIds(parent.id);
          return [parent.id, ...descendantIds];
        }),
      );

      const children = removeDuplicates(_children.flat());
      filter.groupId = In(getArray(children));
    }

    if (isDate(req.from)) {
      filter.startDate = MoreThanOrEqual(req.from);
    }

    if (isDate(req.to)) {
      filter.endDate = LessThanOrEqual(req.to);
    }

    const data = await this.repository.find({
      select: ['name', 'metaData', 'category', 'id'],
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
        firstName: submittedBy?.firstName,
        middleName: submittedBy?.middleName,
        lastName: submittedBy?.lastName,
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

  private getClosureQueryParams() {
    const metadata = this.groupRepository.metadata;
    const closureMetadata = metadata.closureJunctionTable;
    const groupTable = metadata.schema
      ? `"${metadata.schema}"."${metadata.tableName}"`
      : `"${metadata.tableName}"`;
    const closureTable = closureMetadata.schema
      ? `"${closureMetadata.schema}"."${closureMetadata.tableName}"`
      : `"${closureMetadata.tableName}"`;
    const ancestorColumn = closureMetadata.ancestorColumns[0].databaseName;
    const descendantColumn = closureMetadata.descendantColumns[0].databaseName;
    return { groupTable, closureTable, ancestorColumn, descendantColumn };
  }

  private async getDescendantIds(groupId: number): Promise<number[]> {
    const { groupTable, closureTable, ancestorColumn, descendantColumn } =
      this.getClosureQueryParams();

    const rows: Array<{ id: number }> = await this.groupRepository.query(
      `SELECT g.id FROM ${groupTable} g
       JOIN ${closureTable} c ON c."${descendantColumn}" = g.id
       WHERE c."${ancestorColumn}" = $1
         AND g.id != $1`,
      [groupId],
    );
    return rows.map((row) => row.id);
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
    const data = await this.repository.findOne({
      where: { id },
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
