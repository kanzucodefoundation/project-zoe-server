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
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Repository, Connection } from 'typeorm';
import { ReportSubmissionDto } from './dto/report-submission.dto';
import { ReportDto } from './dto/report.dto';
import { Report } from './entities/report.entity';
import {
  ApiResponse,
  ReportSubmissionsApiResponse,
  ReportSubmissionDataDto,
} from './types/report-api.types';
import { getFormattedDateString } from 'src/utils/stringHelpers';
import { ReportSubmission } from './entities/report.submission.entity';
import { AppLogger } from '../utils/app-logger.service';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Reports')
@Controller('api/reports')
export class ReportsController {
  constructor(
    private readonly reportService: ReportsService,
    private readonly logger: AppLogger,
  ) {}

  @Post()
  createReport(
    @Body() reportDto: ReportDto,
    @Request() request,
  ): Promise<ReportDto> {
    return this.reportService.createReport(reportDto, request.user);
  }

  @Post(':reportId/submissions')
  async submitReport(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() submissionDto: ReportSubmissionDto,
    @Request() request,
  ): Promise<ApiResponse<ReportSubmissionDataDto>> {
    this.logger.apiLog('log', 'Report submission request received', {
      operation: 'submitReport',
      resource: 'reports',
      metadata: {
        reportId,
        userId: request.user?.id,
      },
    });
    submissionDto.reportId = reportId;
    return await this.reportService.submitReport(submissionDto, request.user);
  }

  @Get('submissions/me')
  async getMySubmissions(
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
    @Query('reportId') reportId: number | undefined,
    @Request() request: any,
  ): Promise<any> {
    this.logger.apiLog('log', 'Get my submissions request received', {
      operation: 'getMySubmissions',
      resource: 'reports',
      metadata: {
        userId: request.user?.id,
        limit,
        offset,
        reportId,
      },
    });
    return await this.reportService.getMySubmissions(request.user, {
      limit,
      offset,
      reportId,
    });
  }

  @Get('submissions/mygroups')
  async getMyGroupsSubmissions(
    @Query('reportId') reportId: number | undefined,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
    @Query('from') startDate?: string,
    @Query('to') endDate?: string,
    @Request() request?: any,
  ): Promise<any> {
    return await this.reportService.getMyGroupsSubmissions(request.user, {
      reportId,
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('submissions/:id')
  async getSubmissionDetails(
    @Param('id', ParseIntPipe) id: number,
    @Request() request,
  ): Promise<any> {
    this.logger.apiLog('log', 'Get submission details request received', {
      operation: 'getSubmissionDetails',
      resource: 'reports',
      metadata: {
        submissionId: id,
        userId: request.user?.id,
      },
    });
    return await this.reportService.getSubmissionDetails(id, request.user);
  }

  @Get(':id')
  async getReport(@Param('id') reportId: number): Promise<Report> {
    this.logger.apiLog('log', 'Get report request received', {
      operation: 'getReport',
      resource: 'reports',
      metadata: {
        reportId,
      },
    });

    // Handle invalid/NaN IDs
    const parsedId = parseInt(reportId as any, 10);
    if (isNaN(parsedId)) {
      this.logger.apiLog('warn', 'Invalid report ID provided', {
        operation: 'getReport',
        resource: 'reports',
        metadata: {
          invalidReportId: reportId,
        },
      });
      throw new BadRequestException('Invalid report ID provided');
    }

    return await this.reportService.getReport(parsedId);
  }

  @Put(':id')
  async updateReport(
    @Param('id') id: number,
    @Body() updateDto: ReportDto,
  ): Promise<Report> {
    return await this.reportService.updateReport(id, updateDto);
  }

  @Get()
  async getAllReports(): Promise<{ reports: any[] }> {
 

    try {
      this.logger.apiLog('log', 'Starting get all reports request', {
        operation: 'getAllReports',
        resource: 'reports',
      });

      const result = await this.reportService.getAllReports();

      this.logger.apiLog('log', 'Successfully retrieved all reports', {
        operation: 'getAllReports',
        resource: 'reports',
        metadata: {
          reportCount: result.reports?.length || 0,
        },
      });

       return result;
    } catch (error) {
      this.logger.errorLog(error, {
        operation: 'getAllReports',
        resource: 'reports',
      });
       throw error;
    }
  }

  @Get(':reportId/submissions')
  async getReportSubmissions(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Query('from') startDate?: string,
    @Query('to') endDate?: string,
    @Query('groupIdList') smallGroupIdList?: string,
    @Query('parentGroupIdList') parentGroupIdList?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    this.logger.apiLog('log', 'Get report submissions request received', {
      operation: 'getReportSubmissions',
      resource: 'reports',
      metadata: {
        reportId,
        startDate,
        endDate,
        smallGroupIdList,
        parentGroupIdList,
      },
    });
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

  @Get(':reportId/submissions/:submissionId')
  async getReportSubmission(
    @Param('reportId') reportId: number,
    @Param('submissionId') submissionId: number,
  ) {
    this.logger.apiLog('log', 'Get specific report submission request received', {
      operation: 'getReportSubmission',
      resource: 'reports',
      metadata: {
        reportId,
        submissionId,
      },
    });
    return this.reportService.getReportSubmission(reportId, submissionId);
  }

  @Post(':reportId/send-weekly-email')
  async sendReportSubmissionsWeeklyEmail(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Query('groupIdList') smallGroupIdList?: string,
    @Query('parentGroupIdList') parentGroupIdList?: string,
  ): Promise<string> {
    this.logger.apiLog('log', 'Send weekly email summary request received', {
      operation: 'sendReportSubmissionsWeeklyEmail',
      resource: 'reports',
      metadata: {
        reportId,
        smallGroupIdList,
        parentGroupIdList,
      },
    });
    return await this.reportService.sendWeeklyEmailSummary(
      reportId,
      smallGroupIdList,
      parentGroupIdList,
    );
  }
}
