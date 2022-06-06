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
import Occasion from "../entities/occasion.entity";
import { Repository, Connection } from "typeorm";
import SearchDto from "../../shared/dto/search.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Crm Occasions")
@Controller("api/crm/occasions")
export class OccasionsController {
  private readonly repository: Repository<Occasion>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(Occasion);
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<Occasion[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  @Post()
  async create(@Body() data: Occasion): Promise<Occasion> {
    return await this.repository.save(data);
  }

  @Put()
  async update(@Body() data: Occasion): Promise<Occasion> {
    return await this.repository.save(data);
  }

  @Get(":id")
  async findOne(@Param("id") id: number): Promise<Occasion> {
    return await this.repository.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
