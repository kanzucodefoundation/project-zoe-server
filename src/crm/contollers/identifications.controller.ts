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
import Identification from "../entities/identification.entity";
import { Repository } from "typeorm";
import SearchDto from "../../shared/dto/search.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Crm Identifications")
@Controller("api/crm/identifications")
export class IdentificationsController {
  private readonly repository: Repository<Identification>;

  constructor(@Inject("CONNECTION") connection) {
    this.repository = connection.getRepository(Identification);
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Identification[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Identification): Promise<Identification> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Identification): Promise<Identification> {
    return await this.repository.save(data);
  }

  @Get(":id")
  async findOne(@Param("id") id: number): Promise<Identification> {
    return await this.repository.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
