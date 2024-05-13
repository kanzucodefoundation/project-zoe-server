import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Query,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  Body,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { Repository, Connection } from "typeorm";
import {
  ReportSubmissionDto,
  reportSubmissionSchema,
} from "./dto/report-submission.dto";
import { ReportDto } from "./dto/report.dto";
import { Report } from "./entities/report.entity";
import {
  ApiResponse,
  ReportSubmissionsApiResponse,
  ReportSubmissionDataDto,
} from "./types/report-api.types";
import { getFormattedDateString } from "src/utils/stringHelpers";
import { ReportSubmission } from "./entities/report.submission.entity";
import { CreateReportValidatorPipe } from "src/utils/validation";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Reports")
@Controller("api/reports")
export class ReportsController {
  constructor(private readonly reportService: ReportsService) {}

  @Post()
  createReport(
    @Body() reportDto: ReportDto,
    @Request() request,
  ): Promise<ReportDto> {
    return this.reportService.createReport(reportDto, request.user);
  }

  @Post("submit")
  // validaiton of submitted schema
  @UsePipes(new CreateReportValidatorPipe(reportSubmissionSchema))
  async submitReport(
    @Body() submissionDto: ReportSubmissionDto,
    @Request() request,
  ): Promise<ApiResponse<ReportSubmissionDataDto>> {
    return await this.reportService.submitReport(submissionDto, request.user);
  }

  @Get(":reportId")
  async getReport(@Param("reportId") reportId: number): Promise<Report> {
    return await this.reportService.getReport(reportId);
  }

  @Put(":id")
  async updateReport(
    @Param("id") id: number,
    @Body() updateDto: ReportDto,
  ): Promise<Report> {
    return await this.reportService.updateReport(id, updateDto);
  }

  @Get()
  async getAllReports(): Promise<Report[]> {
    return await this.reportService.getAllReports();
  }

  @Get(":reportId/submissions")
  async getReportSubmissions(
    @Param("reportId", ParseIntPipe) reportId: number,
    @Query("from") startDate?: string,
    @Query("to") endDate?: string,
    @Query("groupIdList") smallGroupIdList?: string,
    @Query("parentGroupIdList") parentGroupIdList?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    const formattedStartDate = startDate ? new Date(startDate) : undefined;
    const formattedEndDate = endDate ? new Date(endDate) : undefined;
    return await this.reportService.generateReport(
      reportId,
      formattedStartDate,
      formattedEndDate,
      smallGroupIdList,
      parentGroupIdList,
    );
  }

  @Get(":reportId/submissions/:submissionId")
  async getReportSubmission(
    @Param("reportId") reportId: number,
    @Param("submissionId") submissionId: number,
  ) {
    return this.reportService.getReportSubmission(reportId, submissionId);
  }

  @Post(":reportId/send-weekly-email")
  async sendReportSubmissionsWeeklyEmail(
    @Param("reportId", ParseIntPipe) reportId: number,
    @Query("groupIdList") smallGroupIdList?: string,
    @Query("parentGroupIdList") parentGroupIdList?: string,
  ): Promise<string> {
    return await this.reportService.sendWeeklyEmailSummary(
      reportId,
      smallGroupIdList,
      parentGroupIdList,
    );
  }
}
