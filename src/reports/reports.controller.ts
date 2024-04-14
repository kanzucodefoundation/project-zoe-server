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
  ReportSubmissionDataDto,
} from "./types/report-api.types";
import { getFormattedDateString } from "src/utils/stringHelpers";
import { ReportSubmission } from "./entities/report.submission.entity";

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
    return await this.reportService.getSmallGroupSummaryAttendance(
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

  // Small Group Weekly Attendance  Report
  // @TODO Get this with the above method of reportId, but do a check on the name and then call this logic instead
  @Get(":reportId/weekly-small-group-attendance")
  async getWeeklyMCReports(@Param("reportId") reportId: number): Promise<any> {
    const submissions =
      await this.reportService.getSmallGroupSummaryAttendance(reportId);
    const dateColumns = [];

    // Intermediate data structure to organize the data
    const mcDataMap: Record<string, any> = {};

    // Intermediate data structure to store smallGroupName averages
    const smallGroupNameAverages: Record<string, number> = {};

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
      const sundayKey = getFormattedDateString(currentSunday);

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

    // Process submissions and organize the data by smallGroupName and Sunday
    submissions.data.forEach((submission: any) => {
      const smallGroupName = submission.smallGroupName;
      const smallGroupNumberOfMembers = submission.smallGroupNumberOfMembers;
      const mcParticipantCount = parseInt(submission.smallGroupAttendanceCount);
      const submittedAt = submission.date; // Group by the date of the meeting
      const submittedDate = new Date(submittedAt);

      // Find the next Sunday date after the submitted date
      const nextSunday = new Date(submittedDate);
      nextSunday.setDate(
        submittedDate.getDate() + (7 - submittedDate.getDay()),
      );

      // Generate the key in the format "YYYYMMDD" for the Sunday date
      const sundayKey = getFormattedDateString(nextSunday);

      // Create the mcData object if it doesn't exist
      if (!mcDataMap[smallGroupName]) {
        mcDataMap[smallGroupName] = {
          smallGroupName,
          smallGroupNumberOfMembers,
        };
      }

      // Store the mcParticipantCount for the corresponding Sunday
      mcDataMap[smallGroupName][sundayKey] = mcParticipantCount;

      // Update the sum for the smallGroupName average
      if (!smallGroupNameAverages[smallGroupName]) {
        smallGroupNameAverages[smallGroupName] = 0;
      }
      smallGroupNameAverages[smallGroupName] += mcParticipantCount;
    });

    // Assign the average values to the corresponding mcData objects
    Object.keys(smallGroupNameAverages).forEach((smallGroupName: string) => {
      const average =
        smallGroupNameAverages[smallGroupName] /
        (Object.keys(mcDataMap[smallGroupName]).length - 2); // The 2 accounts for the extra columns smallGroupNumberOfMembers and smallGroupName
      mcDataMap[smallGroupName].average = average.toFixed(2);
    });

    // Generate the final response in the desired format
    const data = Object.values(mcDataMap);
    const columns = [
      { name: "smallGroupName", label: "MC Name" },
      { name: "smallGroupNumberOfMembers", label: "MC Members" },
      ...dateColumns,
      { name: "average", label: "Average" },
    ];
    const dataArray = [];
    dataArray.push({ reportId, data, columns, footer: null });
    return dataArray;
  }
}
