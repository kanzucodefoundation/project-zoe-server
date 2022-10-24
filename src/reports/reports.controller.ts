import {
  Controller,
  Get,
  Query,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { Repository, Connection } from "typeorm";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Reports")
@Controller("api/reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get(":name")
  async findOne(@Param("name") name: string, @Request() req): Promise<string> {
    return this.service.getReport(name, req.user);
  }
}
