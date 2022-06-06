import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Inject,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiTags } from "@nestjs/swagger";
import EventCategory from "../entities/eventCategory.entity";
import { Repository, Connection } from "typeorm";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Events Categories")
@Controller("api/events/category")
export class EventsCategoriesController {
  private readonly repository: Repository<EventCategory>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(EventCategory);
  }

  @Get()
  async findAll(): Promise<EventCategory[]> {
    return await this.repository.find({});
  }

  @Post()
  async create(@Body() data: EventCategory): Promise<EventCategory> {
    return this.repository.save(data);
  }

  @Put()
  async update(@Body() { id, ...data }: EventCategory): Promise<EventCategory> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  @Get(":id")
  async findOne(@Param("id") id: any): Promise<EventCategory> {
    return await this.repository.findOne(id, {
      relations: ["fields"],
    });
  }

  @Delete(":id")
  async remove(@Param("id") id: any): Promise<void> {
    await this.repository.delete(id);
  }
}
