import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Request,
  UseGuards,
  Body,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { Repository, Connection } from "typeorm";
import { ReportSubmissionDto } from "./dto/report-submission.dto";
import { ReportDto } from "./dto/report.dto";
import { Report } from "./entities/report.entity";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Reports")
@Controller("api/reports")
export class ReportsController {
  constructor(private readonly reportService: ReportsService) {}

  @Post()
  createReport(@Body() reportDto: ReportDto): Promise<Report> {
    return this.reportService.createReport(reportDto);
  }

  @Post("submit")
  async submitReport(
    @Body() submissionDto: ReportSubmissionDto,
    @Request() request,
  ): Promise<void> {
    await this.reportService.submitReport(submissionDto, request.user);
  }

  @Get()
  async getReports(
    @Query("group") groupId: number,
    @Query("date") submissionDate: string,
  ): Promise<any[]> {
    return this.reportService.getReports(groupId, submissionDate);
  }

  //@Patch(':id')
  //async updateReport(@Param('id') id: number, @Body() updateDto: Partial<ReportDto>): Promise<void> {
  //  await this.reportService.updateReport(id, updateDto);
  //}
}
