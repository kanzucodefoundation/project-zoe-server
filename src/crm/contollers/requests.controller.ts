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
  Inject,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import Request from "../entities/request.entity";
import { Repository, Connection } from "typeorm";
import SearchDto from "../../shared/dto/search.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Crm Requests")
@Controller("api/crm/requests")
export class RequestsController {
  private readonly repository: Repository<Request>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(Request);
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Request[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Request): Promise<Request> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Request): Promise<Request> {
    return await this.repository.save(data);
  }

  @Get(":id")
  async findOne(@Param("id") id: number): Promise<Request> {
    return await this.repository.findOne({ where: { id } });
  }

  @Delete(":id")
  async remove(@Param("id") id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
