import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  Inject,
  ValidationPipe,
} from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiTags } from "@nestjs/swagger";
import { Repository, Connection } from "typeorm";
import EventAttendance from "../entities/eventAttendance.entity";
import GroupEvent from "../entities/event.entity";
import GroupMembership from "../../groups/entities/groupMembership.entity";
import GroupMembershipDto from "../../groups/dto/membership/group-membership.dto";
import { getPersonFullName } from "../../crm/crm.helpers";
import { GroupRole } from "../../groups/enums/groupRole";
import EventAttendanceSearchDto from "../dto/event-attendance-search.dto";
import { EventAttendanceDto } from "../dto/event-attendance.dto";
import { EventAttendanceCreateDto } from "../dto/event-attendance-create.dto";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Events Attendance")
@Controller("api/events/attendance")
export class EventsAttendanceController {
  private readonly repository: Repository<EventAttendance>;
  private readonly groupRepository: Repository<GroupEvent>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private prisma: PrismaService,
  ) {
    this.repository = connection.getRepository(EventAttendance);
    this.groupRepository = connection.getRepository(GroupEvent);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  @Get()
  async findAll(@Query() req: EventAttendanceSearchDto): Promise<{
    attendance: EventAttendance[];
    memberships: GroupMembershipDto[];
  }> {
    const filter = {};
    if (req.groupId) {
      filter["groupId"] = { equals: req.groupId };
    }
    const data = await this.prisma.group_membership.findMany({
      include: {
        group: {
          select: { id: true, name: true },
        },
        contact: {
          include: {
            person: {
              select: { firstName: true, lastName: true, middleName: true },
            },
          },
        },
      },
      where: { groupId: { equals: req.groupId } },
    });
    const memberships: GroupMembershipDto[] = data.map((it) => {
      return {
        id: it.id,
        groupId: it.groupId,
        group: it.group,
        isInferred: false,
        contact: {
          id: it.contact.id,
          name: getPersonFullName(it.contact.person),
        },
        contactId: it.contactId,
        role: GroupRole[it.role],
      };
    });

    const attData = await this.prisma.event_attendance.findMany({
      include: {
        contact: {
          include: {
            person: {
              select: { firstName: true, lastName: true, middleName: true },
            },
          },
        },
      },
      where: { eventId: { equals: req.eventId } },
    });
    const attendance: EventAttendanceDto[] = attData.map((it) => {
      return {
        id: it.id,
        contactId: it.contactId,
        eventId: it.eventId,
        attended: it.attended,
        isVisitor: it.isVisitor,
        contact: {
          id: it.contact.id,
          name: getPersonFullName(it.contact.person),
        },
        event: null,
      };
    });

    return { attendance, memberships };
  }

  @UsePipes(
    new ValidationPipe({
      transform: true,
      skipMissingProperties: true,
      whitelist: true,
    }),
  )
  @Post()
  async create(
    @Body() { id, ...data }: EventAttendanceCreateDto,
  ): Promise<EventAttendanceDto> {
    const groupData = await this.groupRepository
      .createQueryBuilder("groupId")
      .where("Id =:Id", { Id: data.eventId })
      .getOne();

    const checkVisitor = await this.repository
      .createQueryBuilder()
      .leftJoin("events", "event", '"eventId"="event".Id')
      .where(
        '"contactId"=:contactId AND "isVisitor"=:isVisitor AND "groupId"=:groupId',
        {
          contactId: data.contactId,
          isVisitor: true,
          groupId: groupData.groupId,
        },
      )
      .execute();

    if (checkVisitor.length <= 0 && data.attended) {
      data.isVisitor = true;
    } else {
      data.isVisitor = false;
    }

    if (id !== 0) {
      await this.repository
        .createQueryBuilder()
        .update()
        .set({
          ...data,
        })
        .where("id = :id", { id })
        .execute();
      return this.findOne(id);
    } else {
    }
  }

  @Put()
  async update(
    @Body() { id, ...data }: EventAttendanceCreateDto,
  ): Promise<EventAttendanceDto> {
    await this.repository.update(id, data);
    return this.findOne(id);
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<EventAttendanceDto> {
    const it = await this.prisma.event_attendance.findFirst({
      include: {
        contact: {
          include: {
            person: {
              select: { firstName: true, lastName: true, middleName: true },
            },
          },
        },
      },
      where: { id: { equals: id } },
    });
    return {
      id: it.id,
      contactId: it.contactId,
      eventId: it.eventId,
      attended: it.attended,
      isVisitor: it.isVisitor,
      contact: {
        id: it.contact.id,
        name: getPersonFullName(it.contact.person),
      },
      event: null,
    };
  }

  @Delete(":id")
  async remove(@Param("id") id: any): Promise<void> {
    await this.repository.delete(id);
  }
}
