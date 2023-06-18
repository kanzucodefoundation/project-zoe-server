import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Request,
  ParseIntPipe,
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
import {
  ApiResponse,
  ReportSubmissionsApiResponse,
} from "./types/report-api.types";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Reports")
@Controller("api/reports")
export class ReportsController {
  constructor(private readonly reportService: ReportsService) {}

  @Post()
  createReport(@Body() reportDto: any, @Request() request): Promise<Report> {
    //@TODO Use ReportDto for reportDto type and fix validation error
    return this.reportService.createReport(reportDto, request.user);
  }

  @Post("submit")
  async submitReport(
    @Body() submissionDto: ReportSubmissionDto,
    @Request() request,
  ): Promise<void> {
    await this.reportService.submitReport(submissionDto, request.user);
  }

  //@Get('/:reportId')
  //async getReport(): Promise<ApiResponse<ReportApiResponse[]>> {
  //  const startDate = new Date();
  //  const endDate = new Date();
  //  return await this.reportService.getReport(6, startDate, endDate);
  //}

  @Get(":reportId")
  async getReport(@Param("reportId") reportId: number): Promise<Report> {
    return await this.reportService.getReport(reportId);
  }

  @Get(":reportId/submissions")
  async getReportSubmissions(
    @Param("reportId", ParseIntPipe) reportId: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    const formattedStartDate = startDate ? new Date(startDate) : undefined;
    const formattedEndDate = endDate ? new Date(endDate) : undefined;
    return await this.reportService.getReportSubmissions(
      reportId,
      formattedStartDate,
      formattedEndDate,
    );
  }

  //@Patch(':id')
  //async updateReport(@Param('id') id: number, @Body() updateDto: Partial<ReportDto>): Promise<void> {
  //  await this.reportService.updateReport(id, updateDto);
  //}
}
