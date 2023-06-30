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
  createReport(
    @Body() reportDto: ReportDto,
    @Request() request,
  ): Promise<Report> {
    return this.reportService.createReport(reportDto, request.user);
  }

  @Post("submit")
  async submitReport(
    @Body() submissionDto: ReportSubmissionDto,
    @Request() request,
  ): Promise<void> {
    await this.reportService.submitReport(submissionDto, request.user);
  }

  @Get(":reportId")
  async getReport(@Param("reportId") reportId: number): Promise<Report> {
    return await this.reportService.getReport(reportId);
  }

  @Put(":id")
  async updateReport(
    @Param("id") id: number,
    @Body() updateDto: ReportDto,
  ): Promise<void> {
    return await this.reportService.updateReport(id, updateDto);
  }

  @Get()
  async getAllReports(): Promise<Report[]> {
    return await this.reportService.getAllReports();
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

  @Get(":reportId/submissions/:submissionId")
  async getReportSubmission(
    @Param("reportId") reportId: number,
    @Param("submissionId") submissionId: number,
  ) {
    return this.reportService.getReportSubmission(reportId, submissionId);
  }

  @Get(":reportId/weekly-mc-reports")
  async getWeeklyMCReports(@Param("reportId") reportId: number): Promise<any> {
    const submissions = await this.reportService.getReportSubmissions(reportId);

    // Intermediate data structure to organize the data
    const mcDataMap: Record<string, any> = {};

    // Process submissions and organize the data by mcName and month-Sunday
    submissions.data.forEach((submission: any) => {
      const mcName = submission.mcName;
      const mcMemberCount = submission.mcMemberCount;
      const mcParticipantCount = parseInt(submission.mcParticipantCount);
      const submittedAt = submission.submittedAt.toISOString();
      const submittedDate = new Date(submittedAt);
      const year = submittedDate.getUTCFullYear();
      const month = submittedDate.getUTCMonth();
      const day = submittedDate.getUTCDay();

      // Find the next Sunday date after the submitted date
      const sundayDate = new Date(submittedDate);
      sundayDate.setDate(
        submittedDate.getDate() + (7 - submittedDate.getDay()),
      );

      // Generate the key in the format "YYYYMMDD" for the Sunday date
      const sundayKey = sundayDate.toISOString().slice(0, 10).replace(/-/g, "");

      // Create the mcData object if it doesn't exist
      if (!mcDataMap[mcName]) {
        mcDataMap[mcName] = {
          mcName,
          mcMemberCount,
        };
      }

      // Store the mcParticipantCount for the corresponding Sunday
      mcDataMap[mcName][sundayKey] = mcParticipantCount;
    });

    // Calculate the average value for each mcData object
    Object.values(mcDataMap).forEach((mcData: any) => {
      const countValues = Object.values(mcData).slice(2);
      if (countValues.length > 0) {
        const sum: any = countValues.reduce(
          (total: number, count: number) => total + count,
          0,
        );
        const average: any = sum / countValues.length;
        mcData.average = average.toFixed(2);
      } else {
        mcData.average = null; // or 0, depending on your preference
      }
    });

    // Generate the final response in the desired format
    const data = Object.values(mcDataMap);
    const columns = [
      { name: "mcName", label: "MC Name" },
      { name: "mcMemberCount", label: "MC Members" },
      ...submissions.data.map((submission: any) => ({
        name: submission.submittedAt.toISOString(),
        label: submission.submittedAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      })),
      { name: "average", label: "Average" },
    ];

    return { reportId, data, columns, footer: null };
  }
}
