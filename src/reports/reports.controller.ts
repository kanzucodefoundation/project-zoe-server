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

  // Small Group Weekly Attendance  Report
  // @TODO Get this with the above method of reportId, but do a check on the name and then call this logic instead
  @Get(":reportId/weekly-small-group-attendance")
  async getWeeklyMCReports(@Param("reportId") reportId: number): Promise<any> {
    const submissions = await this.reportService.getReportSubmissions(reportId);
    const dateColumns = [];

    // Intermediate data structure to organize the data
    const mcDataMap: Record<string, any> = {};

    // Intermediate data structure to store mcName averages
    const mcNameAverages: Record<string, number> = {};

    // Get the start and end dates of the month
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    // Iterate through the Sundays in the month
    let currentSunday = new Date(startOfMonth);
    currentSunday.setDate(startOfMonth.getDate() + (7 - startOfMonth.getDay()));

    while (currentSunday <= endOfMonth) {
      const sundayKey = currentSunday
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const sundayLabel = currentSunday.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Add the Sunday column to the columns array
      dateColumns.push({ name: sundayKey, label: sundayLabel });

      // Move to the next Sunday
      currentSunday.setDate(currentSunday.getDate() + 7);
    }

    // Process submissions and organize the data by mcName and Sunday
    submissions.data.forEach((submission: any) => {
      const mcName = submission.mcName; // @TODO Change mcName to smallGroupName
      const mcMemberCount = submission.mcMemberCount; // @TODO change to smallGroupNumberOfMembers
      const mcParticipantCount = parseInt(submission.mcParticipantCount); // @TODO change to smallGroupAttendanceCount. What differs from church to church is the labels
      const submittedAt = submission.submittedAt.toISOString(); // @TODO Group by submittedAt or by the date of the meeting? I think the latter
      const submittedDate = new Date(submittedAt);

      // Find the next Sunday date after the submitted date
      const nextSunday = new Date(submittedDate);
      nextSunday.setDate(
        submittedDate.getDate() + (7 - submittedDate.getDay()),
      );

      // Generate the key in the format "YYYYMMDD" for the Sunday date
      const sundayKey = nextSunday.toISOString().slice(0, 10).replace(/-/g, "");

      // Create the mcData object if it doesn't exist
      if (!mcDataMap[mcName]) {
        mcDataMap[mcName] = {
          mcName,
          mcMemberCount,
        };
      }

      // Store the mcParticipantCount for the corresponding Sunday
      mcDataMap[mcName][sundayKey] = mcParticipantCount;

      // Update the sum for the mcName average
      if (!mcNameAverages[mcName]) {
        mcNameAverages[mcName] = 0;
      }
      mcNameAverages[mcName] += mcParticipantCount;
    });

    // Assign the average values to the corresponding mcData objects
    Object.keys(mcNameAverages).forEach((mcName: string) => {
      const average =
        mcNameAverages[mcName] / (Object.keys(mcDataMap[mcName]).length - 2); // The 2 accounts for the extra columns mcMemberCount and mcName
      mcDataMap[mcName].average = average.toFixed(2);
    });

    // Generate the final response in the desired format
    const data = Object.values(mcDataMap);
    const columns = [
      { name: "mcName", label: "MC Name" },
      { name: "mcMemberCount", label: "MC Members" },
      ...dateColumns,
      { name: "average", label: "Average" },
    ];

    return { reportId, data, columns, footer: null };
  }
}
