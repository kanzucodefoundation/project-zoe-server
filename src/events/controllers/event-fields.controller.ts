import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Inject,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiTags } from "@nestjs/swagger";
import { Repository, Connection } from "typeorm";
import EventField from "../entities/eventField.entity";
import EventFieldSearchDto from "../dto/event-field-search.dto";
import { FindConditions } from "typeorm/find-options/FindConditions";
import { hasValue } from "../../utils/validation";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Events Fields")
@Controller("api/events/fields")
export class EventsFieldsController {
  private readonly repository: Repository<EventField>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(EventField);
  }

  @Get()
  async findAll(@Query() search: EventFieldSearchDto): Promise<EventField[]> {
    const query: FindConditions<EventField> = {};
    if (hasValue(search.category)) {
      query.category = search.category;
    }
    return await this.repository.find({ where: query });
  }

  @Post()
  async create(@Body() data: EventField): Promise<EventField> {
    return this.repository.save(data);
  }

  @Put()
  async update(@Body() { id, ...data }: EventField): Promise<EventField> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  @Get(":id")
  async findOne(@Param("id") id: any): Promise<EventField> {
    return await this.repository.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: any): Promise<void> {
    await this.repository.delete(id);
  }
}
