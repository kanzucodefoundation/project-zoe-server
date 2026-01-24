import {
  Injectable,
  Inject,
  NotFoundException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Connection, Repository, In, Not } from 'typeorm';
import { UserDto } from 'src/auth/dto/user.dto';
import { Report } from './entities/report.entity';
import { ReportSubmission } from './entities/report.submission.entity';
import { ReportSubmissionDto } from './dto/report-submission.dto';
import { ReportDto } from './dto/report.dto';
import { User } from 'src/users/entities/user.entity';
import { IEmail, sendEmail } from 'src/utils/mailer';
import {
  getUserDisplayName,
  getHumanReadableDate,
} from 'src/utils/stringHelpers';

import {
  ReportSubmissionsApiResponse,
  ApiResponse,
  ReportSubmissionDataDto,
} from './types/report-api.types';
import { TreeRepository } from 'typeorm';
import Group from 'src/groups/entities/group.entity';
import { UsersService } from 'src/users/users.service';
import { GroupsService } from 'src/groups/services/groups.service';
import { GroupTreeService } from 'src/groups/services/group-tree.service';
import { ReportField } from './entities/report.field.entity';
import { ReportSubmissionData } from './entities/report.submission.data.entity';
import { GroupCategoryNames } from 'src/groups/enums/groups';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import { GroupRole } from 'src/groups/enums/groupRole';
import { ReportStatus } from './enums/report.enum';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';

@Injectable()
export class ReportsService {
  private readonly reportRepository: Repository<Report>;
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly reportSubmissionDataRepository: Repository<ReportSubmissionData>;
  private readonly userRepository: Repository<User>;
  private readonly reportFieldRepository: Repository<ReportField>;
  private readonly groupMembershipRepo: Repository<GroupMembership>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly usersService: UsersService,
    private readonly groupsService: GroupsService,
    private readonly groupTreeService: GroupTreeService,
    private readonly appLogger: AppLogger,
  ) {
    this.reportRepository = connection.getRepository(Report);
    this.reportFieldRepository = connection.getRepository(ReportField);
    this.groupMembershipRepo = connection.getRepository(GroupMembership);
    this.reportSubmissionDataRepository =
      connection.getRepository(ReportSubmissionData);
    this.reportSubmissionRepository =
      connection.getRepository(ReportSubmission);
    this.treeRepository = connection.getTreeRepository(Group);
    this.userRepository = connection.getRepository(User);
    this.logger = this.appLogger.createContextLogger('ReportsService');
  }

  async createReport(reportDto: ReportDto, user: UserDto): Promise<ReportDto> {
    const report = new Report();
    report.name = reportDto.name;
    report.description = reportDto.description;
    report.submissionFrequency = reportDto.submissionFrequency;
    report.viewType = reportDto.viewType;
    report.displayColumns = reportDto.displayColumns;
    report.user = await this.userRepository.findOne({ where: { id: user.id } });

    // Create ReportField entities for each field in reportDto.fields
    const fields = reportDto.fields.map((fieldDto) => {
      const field = new ReportField();
      field.name = fieldDto.name;
      field.type = fieldDto.type;
      field.label = fieldDto.label;
      field.required = fieldDto.required;
      field.options = fieldDto.options;
      return field;
    });
    report.fields = fields;
    Object.assign(report, reportDto);
    await this.reportRepository.save(report);
    return reportDto;
  }

  async submitReport(
    submissionDto: ReportSubmissionDto,
    user: UserDto,
  ): Promise<ApiResponse<ReportSubmissionDataDto>> {
    const { reportId, data } = submissionDto;

    // Retrieve the report by its ID
    const report = await this.reportRepository.findOne({
      where: { id: reportId, status: ReportStatus.ACTIVE },
      relations: ['targetGroupCategory'],
    });
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    // Retrieve the user
    const submittingUser = await this.userRepository.findOne({
      where: { id: user.id },
    });
    if (!submittingUser) {
      throw new NotFoundException(`User with ID ${user.id} not found`);
    }

    let targetGroup: Group | null = null;
    let selectedGroupId: number | null = null;

    // Check if report has a designated group field
    if (report.groupFieldName && submissionDto.data[report.groupFieldName]) {
      selectedGroupId = parseInt(submissionDto.data[report.groupFieldName]);

      // Validate user can submit for this group
      const canSubmitForGroup = await this.validateUserGroupPermission(
        submittingUser.contactId,
        selectedGroupId,
        report.targetGroupCategory?.id,
      );

      if (!canSubmitForGroup) {
        throw new BadRequestException(
          `You don't have permission to submit reports for group ID ${selectedGroupId}`,
        );
      }

      targetGroup = await this.treeRepository.findOne({
        where: { id: selectedGroupId },
      });

      if (!targetGroup) {
        throw new BadRequestException(
          `Group with ID ${selectedGroupId} not found`,
        );
      }
    }
    // Fallback to current automatic detection
    else if (report.targetGroupCategory) {
      const userGroups = await this.getUserGroupsInCategory(
        submittingUser.contactId,
        report.targetGroupCategory.id,
      );

      if (userGroups.length === 0) {
        throw new BadRequestException(
          "You don't belong to any groups in the required category",
        );
      }
      if (userGroups.length > 1) {
        throw new BadRequestException(
          'You belong to multiple groups in this category. Please contact an admin to configure a group selection field for this report.',
        );
      }

      targetGroup = userGroups[0];
    }

    // Create and save the report submission
    const reportSubmission = new ReportSubmission();
    reportSubmission.report = report;
    reportSubmission.submittedAt = new Date();
    reportSubmission.user = submittingUser;
    if (targetGroup) {
      reportSubmission.group = targetGroup;
    }
    const savedSubmission =
      await this.reportSubmissionRepository.save(reportSubmission);

    // Retrieve all fields for the report to map field names to their respective entities
    const fields = await this.reportFieldRepository.find({
      where: { report: { id: report.id } },
    });
    const fieldNameToFieldMap = new Map(
      fields.map((field) => [field.name, field]),
    );
    // Prepare SubmissionData entities
    const submissionDataEntities = Object.entries(data).map(
      ([fieldName, fieldValue]) => {
        const field = fieldNameToFieldMap.get(fieldName);
        if (!field) {
          throw new Error(`Field with name '${fieldName}' not found in report`);
        }
        const submissionData = new ReportSubmissionData();
        submissionData.reportSubmission = savedSubmission;
        submissionData.reportField = field; // Directly use the field entity
        submissionData.fieldValue = fieldValue;
        return submissionData;
      },
    );

    // Save all SubmissionData entities
    await this.reportSubmissionDataRepository.save(submissionDataEntities);

    // Prepare the response
    const response: ApiResponse<ReportSubmissionDataDto> = {
      data: {
        reportId: savedSubmission.report.id,
        submissionId: savedSubmission.id,
        submittedAt: savedSubmission.submittedAt,
        submittedBy: savedSubmission.user.username,
      },
      status: HttpStatus.OK,
      message: 'Report submitted successfully.',
    };

    // Send confirmation email (assuming sendMail is an asynchronous operation)
    const formattedDate = getHumanReadableDate(savedSubmission.submittedAt);
    const fullName = getUserDisplayName(savedSubmission.user);
    await this.sendMail(
      savedSubmission.user.username,
      'Project Zoe - Report Submitted',
      { submissionDate: formattedDate, fullName },
    );

    return response;
  }

  async getAllReports(user?: UserDto): Promise<{ reports: any[] }> {
    const tracking = this.logger.startTracking('getAllReports', {
      userId: user?.id,
      contactId: user?.contactId,
    });

    try {
      this.logger.business('log', 'Starting report retrieval', {
        operation: 'getAllReports',
        userId: user?.id,
        contactId: user?.contactId,
        resource: 'reports',
      });

      this.logger.dataAccess('debug', 'Querying active reports from database', {
        operation: 'getAllReports',
        userId: user?.id,
      });

      const reports = await this.reportRepository.find({
        where: { status: ReportStatus.ACTIVE },
        relations: ['fields', 'targetGroupCategory'],
      });

      this.logger.business('log', 'Reports retrieved from database', {
        operation: 'getAllReports',
        userId: user?.id,
        metadata: {
          totalReportsFound: reports.length,
          hasUserFilter: !!user,
        },
      });

      // If user is provided, filter reports based on their group permissions
      let filteredReports = reports;
      if (user) {
        this.logger.security('log', 'Applying user permission filtering', {
          operation: 'getAllReports',
          userId: user?.id,
          contactId: user?.contactId,
          metadata: { reportCountBeforeFilter: reports.length },
        });

        filteredReports = await this.filterReportsByUserPermissions(
          reports,
          user,
        );

        this.logger.security('log', 'Permission filtering completed', {
          operation: 'getAllReports',
          userId: user?.id,
          contactId: user?.contactId,
          metadata: {
            reportCountAfterFilter: filteredReports.length,
            filteredOutCount: reports.length - filteredReports.length,
          },
        });
      }

      this.logger.business('debug', 'Formatting reports for response', {
        operation: 'getAllReports',
        userId: user?.id,
        metadata: { reportCountToFormat: filteredReports.length },
      });

      const formattedReports = filteredReports.map((report) => {
        return {
          id: report.id,
          name: report.name,
          description: report.description,
          submissionFrequency: report.submissionFrequency,
          active: report.active,
          status: report.status,
          targetGroupCategory: report.targetGroupCategory
            ? {
                id: report.targetGroupCategory.id,
                name: report.targetGroupCategory.name,
              }
            : null,
          fieldCount: report.fields ? report.fields.length : 0,
        };
      });

      const result = { reports: formattedReports };

      this.logger.business('log', 'Report retrieval completed successfully', {
        operation: 'getAllReports',
        userId: user?.id,
        contactId: user?.contactId,
        metadata: {
          finalReportCount: formattedReports.length,
          categoriesIncluded: [
            ...new Set(
              formattedReports
                .map((r) => r.targetGroupCategory?.name)
                .filter(Boolean),
            ),
          ],
        },
      });

      this.logger.endTracking(tracking, true);
      return result;
    } catch (error) {
      this.logger.error(error, {
        operation: 'getAllReports',
        userId: user?.id,
        contactId: user?.contactId,
        resource: 'reports',
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async getReport(reportId: number): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId, status: ReportStatus.ACTIVE },
      relations: ['fields', 'targetGroupCategory'],
    });
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }
    return report;
  }

  getWeekNumber(date: Date): number {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // Sun = 0, Mon = 1, ...
    const offset = (firstDayOfWeek < 1 ? 7 : 0) - firstDayOfWeek + 1;
    return Math.ceil((date.getDate() + offset) / 7);
  }

  async getAllSmallGroups(): Promise<Group[]> {
    return this.groupsService.getGroupsByCategory(GroupCategoryNames.MC);
  }

  async generateReport(
    reportId: number,
    startDate?: Date,
    endDate?: Date,
    smallGroupIdList?: string,
    parentGroupIdList?: string,
  ): Promise<any> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['fields', 'submissions'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    // Reports without a custom functionName just return their submissions directly
    if (!report.functionName) {
      return this.getGenericReportSubmissions(report, startDate, endDate);
    }

    // For now, all the reports are aggregate reports.
    switch (report.functionName) {
      case 'getSmallGroupSummaryAttendance':
        return this.getSmallGroupSummaryAttendance(
          report,
          startDate,
          endDate,
          smallGroupIdList,
          parentGroupIdList,
        );
      case 'getSmallGroupReportSubmissionStatus':
        return this.getSmallGroupReportSubmissionStatus(
          report,
          startDate,
          endDate,
        );
      default:
        throw new Error(
          `Function ${report.functionName} is not implemented for custom processing of report ID ${reportId}`,
        );
    }
  }

  private async getGenericReportSubmissions(
    report: Report,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ReportSubmissionsApiResponse> {
    const now = new Date();
    if (!startDate) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
    }
    if (!endDate) {
      endDate = new Date(); // Now
    }

    const submissions = await this.reportSubmissionRepository.find({
      where: {
        report: { id: report.id },
      },
      relations: ['user', 'submissionData', 'submissionData.reportField'],
      order: { submittedAt: 'DESC' },
    });

    // Filter by date range
    const filteredSubmissions = submissions.filter(
      (s) => s.submittedAt >= startDate && s.submittedAt <= endDate,
    );

    const submissionResponses = filteredSubmissions.map((submission) => {
      const transformedData: Record<string, any> = {
        id: submission.id,
        submittedAt: submission.submittedAt.toISOString(),
        submittedBy: getUserDisplayName(submission.user),
      };

      submission.submissionData.forEach((sd) => {
        transformedData[sd.reportField.name] = sd.fieldValue;
      });

      return transformedData;
    });

    const reportColumns = report.displayColumns
      ? Object.values(report.displayColumns)
      : [];

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: 'Submitted At', name: 'submittedAt' },
        { label: 'Submitted By', name: 'submittedBy' },
      ],
      footer: report.footer || [],
    };
  }

  private async buildSubmissionQuery(
    reportId: number,
    startDate: Date,
    endDate: Date,
    smallGroupIds?: number[],
  ) {
    let query = this.reportSubmissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.report', 'report')
      .leftJoinAndSelect('submission.user', 'user')
      .leftJoinAndSelect('submission.submissionData', 'submissionData')
      .leftJoinAndSelect('submissionData.reportField', 'reportField')
      .where('report.id = :reportId', { reportId })
      .andWhere('submission.submittedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (smallGroupIds && smallGroupIds.length > 0) {
      query = query.andWhere(
        "reportField.name = 'smallGroupId' AND submissionData.fieldValue IN (:...smallGroupIds)",
        { smallGroupIds },
      );
    }

    return query;
  }

  async getSmallGroupSummaryAttendance(
    report: Report,
    startDate?: Date,
    endDate?: Date,
    smallGroupIdList?: string,
    parentGroupIdList?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    const now = new Date();
    if (!startDate) {
      startDate = new Date(now.setDate(now.getDate() - now.getDay())); // Set to start of the week, e.g., Sunday
    }
    if (!endDate) {
      endDate = new Date(now.setDate(now.getDate() + 6)); // Set to end of the week, e.g., Saturday
    }
    let smallGroupIds: number[] = [];
    if (smallGroupIdList) {
      smallGroupIds = smallGroupIdList.split(',').map(Number); // Convert CSV to an array of numbers
    }

    if (parentGroupIdList && parentGroupIdList.length) {
      const parentGroupIds = Array.isArray(parentGroupIdList)
        ? parentGroupIdList
        : [parentGroupIdList];
      const smallGroupEntities = await this.treeRepository.find({
        select: ['id'],
        where: { parentId: In(parentGroupIds) },
      });
      smallGroupIds = smallGroupEntities.map((smallGroup) => smallGroup.id);
    }

    const query = await this.buildSubmissionQuery(
      report.id,
      startDate,
      endDate,
      smallGroupIds,
    );

    // Let's get the relevant submissions
    const submissions: ReportSubmission[] = await query.getMany();
    // For each of the retrieved submissions, let's get the user display name & small group parent (The "Zone" in the case of Worship Harvest)
    const submissionResponses = await Promise.all(
      submissions.map(async (submission) => {
        const transformedData = {
          id: submission.id,
          submittedAt: submission.submittedAt.toISOString(), // Ensure date format consistency
          submittedBy: getUserDisplayName(submission.user),
        };

        const smallGroupFieldData = submission.submissionData.find(
          (sd) => sd.reportField.name === 'smallGroupId',
        );

        // Ensure we handle the case where smallGroupFieldData might be undefined
        if (smallGroupFieldData) {
          const smallGroup = await this.treeRepository.findOne({
            where: { id: parseInt(smallGroupFieldData.fieldValue) },
            relations: ['parent'],
          });

          // Add the small group parent
          transformedData['parentGroupName'] = smallGroup?.parent?.name || '';
        }

        // Aggregate submission data into a single object
        submission.submissionData.forEach((sd) => {
          transformedData[sd.reportField.name] = sd.fieldValue;
        });

        return transformedData;
      }),
    );

    const reportColumns = report.displayColumns ? Object.values(report.displayColumns) : []; // Convert columns object to array

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: 'Submitted At', name: 'submittedAt' },
        { label: 'Submitted By', name: 'submittedBy' },
      ],
      footer: report.footer,
    };
  }

  async getSmallGroupReportSubmissionStatus(
    report: Report,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const now = new Date();
    if (!startDate) {
      startDate = new Date(now.setDate(now.getDate() - now.getDay())); // Set to start of the week, e.g., Sunday
    }
    if (!endDate) {
      endDate = new Date(now.setDate(now.getDate() + 6)); // Set to end of the week, e.g., Saturday
    }

    const weekNumber = this.getWeekNumber(startDate);
    const allSmallGroups = await this.getAllSmallGroups();
    const smallGroupIds = allSmallGroups.map((group) => group.id);
    const smallGroupReportId = 1; // TODO: Retrieve this from the DB
    const query = await this.buildSubmissionQuery(
      smallGroupReportId,
      startDate,
      endDate,
      smallGroupIds,
    );

    const submissions: ReportSubmission[] = await query.getMany();
    const submissionResponses = allSmallGroups.map((group) => {
      const submission = submissions.find((sub) =>
        sub.submissionData.some(
          (sd) =>
            sd.reportField.name === 'smallGroupId' &&
            sd.fieldValue === group.id.toString(),
        ),
      );

      const isSubmitted = !!submission;
      const smallGroupFieldData = submission?.submissionData.find(
        (sd) => sd.reportField.name === 'smallGroupId',
      );

      return {
        smallGroupName: group.name,
        weekNumber,
        reportSubmissionStatus: isSubmitted ? 'Submitted' : 'Not Submitted',
        submittedAt: isSubmitted ? submission.submittedAt.toISOString() : '-',
        submittedBy: isSubmitted ? getUserDisplayName(submission.user) : '-',
        missingReports: isSubmitted ? 0 : 1,
      };
    });

    const reportColumns = Object.values(report.displayColumns);

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: 'Submitted At', name: 'submittedAt' },
        { label: 'Submitted By', name: 'submittedBy' },
      ],
      footer: report.footer,
    };
  }

  async getReportSubmission(reportId: number, submissionId: number) {
    // Fetch the submission with its related user and submissionData (including the reportField for each submissionData)
    const submission = await this.reportSubmissionRepository.findOne({
      where: { id: submissionId, report: { id: reportId } },
      relations: ['user', 'submissionData', 'submissionData.reportField'],
    });

    if (!submission) {
      throw new NotFoundException(
        `Report submission with ID ${submissionId} not found`,
      );
    }

    // Transform submissionData into a structured object
    const data = submission.submissionData.reduce((acc, curr) => {
      acc[curr.reportField.name] = curr.fieldValue;
      return acc;
    }, {});

    // Extract labels from submissionData
    const labels = submission.submissionData.map((sd) => {
      return {
        name: sd.reportField.name,
        label: sd.reportField.label,
      };
    });

    // Construct and return the response
    return {
      id: submission.id,
      data: data,
      labels: labels,
      submittedAt: submission.submittedAt.toISOString(), // Ensure consistent date formatting
      submittedBy: getUserDisplayName(submission.user),
    };
  }

  async updateReport(id: number, updateDto: ReportDto): Promise<Report> {
    // Destructure updateDto to separate fields from other properties
    const { fields, ...reportUpdateData } = updateDto;

    // First, update the report itself without the fields
    await this.reportRepository.update(id, reportUpdateData);

    if (fields) {
      await this.updateReportFields(id, fields);
    }

    // After updating, return the updated report entity
    // Note: You may need to reload the report from the database to reflect the updates
    const updatedReport = await this.reportRepository.findOne({
      where: { id },
      relations: ['fields'],
    });

    if (!updatedReport) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return updatedReport;
  }

  async updateReportFields(
    reportId: number,
    fieldsData: Record<string, any>,
  ): Promise<void> {
    // Fetch existing fields for the report
    const existingFields = await this.reportFieldRepository.find({
      where: { report: { id: reportId } },
    });

    // Convert existing fields into a map for easy lookup
    const existingFieldsMap = new Map(
      existingFields.map((field) => [field.name, field]),
    );

    // Iterate over fieldsData to update or add new fields
    for (const [fieldName, fieldAttributes] of Object.entries(fieldsData)) {
      if (existingFieldsMap.has(fieldName)) {
        // Update existing field
        const existingField = existingFieldsMap.get(fieldName);
        await this.reportFieldRepository.update(existingField.id, {
          ...fieldAttributes, // Spread operator to assign new attributes
        });
        existingFieldsMap.delete(fieldName); // Remove from map to track fields that are no longer provided
      } else {
        // Add new field
        await this.reportFieldRepository.save({
          ...fieldAttributes,
          name: fieldName,
          report: { id: reportId }, // Associate with the report
        });
      }
    }

    // Any remaining fields in existingFieldsMap are not present in fieldsData and should be deleted
    for (const [fieldName, existingField] of existingFieldsMap) {
      await this.reportFieldRepository.delete(existingField.id);
    }
  }

  /**
   * Send an email with the reports submitted from
   * Monday to Sunday of the current week
   *
   * @param reportId number
   * @param smallGroupIdList number
   * @param parentGroupIdList number
   * @returns string
   */
  async sendWeeklyEmailSummary(
    reportId: number,
    smallGroupIdList?: string,
    parentGroupIdList?: string,
  ): Promise<string> {
    const currentDate = new Date();

    // Get the current day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const currentDayOfWeek = currentDate.getDay();

    // Calculate the date for the Monday of the current week
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - currentDayOfWeek + 1);
    startDate.setHours(0, 0, 0, 0); // Set to midnight

    // Calculate the date for the Sunday of the current week
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Adding 6 days to get to Sunday
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999

    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['fields', 'submissions'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }
    const reportData: ReportSubmissionsApiResponse =
      await this.getSmallGroupSummaryAttendance(
        report,
        startDate,
        endDate,
        smallGroupIdList,
        parentGroupIdList,
      );
    // Extract the columns from the reportData
    const columns = reportData.columns;

    // Group the reports by zone
    const reportsByZone: { [key: string]: Record<string, any>[] } = {};

    reportData.data.forEach((report) => {
      const zoneName = report.parentGroupName || 'Other'; // Use 'Other' as the default zone name if not specified
      if (!reportsByZone[zoneName]) {
        reportsByZone[zoneName] = [];
      }
      reportsByZone[zoneName].push(report);
    });

    // Initialize the table HTML
    let tableHTML = `
      <table>
        <thead>
          <tr>
            ${columns.map((column) => `<th>${column.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    // Iterate through the reports by zone and populate the table rows
    Object.entries(reportsByZone).forEach(([zoneName, zoneReports]) => {
      tableHTML += `<tr><th colspan="${columns.length}">${zoneName}</th></tr>`;
      zoneReports.forEach((report) => {
        tableHTML += `
          <tr>
            ${columns
              .map((column) => `<td>${report[column.name]}</td>`)
              .join('')}
          </tr>
        `;
      });
    });

    // Close the table HTML
    tableHTML += `
        </tbody>
      </table>
    `;

    // Create the complete HTML email content
    const fullHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly MC Reports</title>
        <style>
            table {
                font-family: Arial, sans-serif;
                border-collapse: collapse;
                width: 100%;
            }
    
            th, td {
                border: 1px solid #dddddd;
                text-align: left;
                padding: 8px;
            }
    
            th {
                background-color: #f2f2f2;
            }
    
            tr:nth-child(even) {
                background-color: #f2f2f2;
            }
    
            h1 {
                font-size: 24px;
            }
        </style>
        </head>
        <body>
          <h1>Weekly MC Reports</h1>
          ${tableHTML}
        </body>
      </html>
    `;

    const usersWithRole = await this.usersService.findByRole('Report Champion');
    const emailAddresses = usersWithRole.map((user) => user.username);
    if (!emailAddresses.length) {
      return 'Error | Weekly email not sent';
    }
    const mailerData = {
      to: emailAddresses.join(', '),
      subject: 'Project Zoe | Weekly MC Reports Submitted',
      html: fullHTML,
    };

    sendEmail(mailerData);
    return 'Weekly email sent successfully';
  }

  sendMail(to: string, subject: string, mailArgs: any) {
    const mailerData: IEmail = {
      to: to,
      subject: subject,
      html: `
            <p>Hello ${mailArgs.fullName},</p></br>
            <p>Your report has been successfully submitted on ${mailArgs.submissionDate}!</p></br>
        `,
    };
    return sendEmail(mailerData);
  }

  async getMySubmissions(
    user: any,
    options: { limit?: number; offset?: number; reportId?: number },
  ): Promise<any> {
    const { limit = 20, offset = 0, reportId } = options;
    const where: any = { user: { id: user.id } };

    if (reportId) {
      where.report = { id: reportId };
    }

    const submissions = await this.reportSubmissionRepository.find({
      where,
      relations: [
        'report',
        'submissionData',
        'submissionData.reportField',
        'group',
        'user',
      ],
      order: { submittedAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const total = await this.reportSubmissionRepository.count({ where });

    return {
      submissions: submissions.map((submission) => ({
        id: submission.id,
        reportId: submission.report.id,
        reportName: submission.report.name,
        groupId: submission.group?.id || null,
        groupName: submission.group?.name || null,
        submittedAt: submission.submittedAt,
        submittedBy: {
          id: submission.user.id,
          name: getUserDisplayName(submission.user),
        },
        status: ReportStatus.SUBMITTED,
        data: submission.submissionData.reduce((acc, curr) => {
          acc[curr.reportField.name] = curr.fieldValue;
          return acc;
        }, {}),
        canEdit: false, // submission.user.id === user.id // User can edit their own submissions. @TODOKEY: Temporarily disabled
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    };
  }

  async getMyGroupsSubmissions(
    user: any,
    options: {
      reportId?: number;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any> {
    const { reportId, limit = 20, offset = 0, startDate, endDate } = options;

    // Get user's accessible groups using the new permission system
    const userGroupIds = await this.getUserAccessibleGroups(user);

    const where: any = {};
    if (reportId) {
      where.report = { id: reportId };
    }
    // @TODO TEMPORARY: Comment out group filtering to see all submissions
    //if (userGroupIds.length > 0) {
    //  where.group = { id: In(userGroupIds) };
    //} else {
    //  return {
    //    submissions: [],
    //    columns: [],
    //    pagination: { total: 0, limit, offset, hasMore: false },
    //  };
    //}

    const submissions = await this.reportSubmissionRepository.find({
      where,
      relations: [
        'report',
        'user',
        'submissionData',
        'submissionData.reportField',
        'group',
      ],
      order: { submittedAt: 'DESC' },
    });

    // Apply date filtering
    let filteredSubmissions = submissions;
    if (startDate || endDate) {
      filteredSubmissions = submissions.filter((sub) => {
        if (startDate && sub.submittedAt < startDate) return false;
        if (endDate && sub.submittedAt > endDate) return false;
        return true;
      });
    }

    const total = filteredSubmissions.length;

    // Apply pagination
    const paginatedSubmissions = filteredSubmissions.slice(
      offset,
      offset + limit,
    );

    // Fetch report fields to build columns (if reportId specified)
    let columns = [];
    if (reportId) {
      const report = await this.reportRepository.findOne({
        where: { id: reportId },
        relations: ['fields'],
      });

      if (report?.fields) {
        columns = report.fields.map((field) => ({
          name: field.name,
          label: field.label || field.name,
        }));
      }
    }

    return {
      submissions: paginatedSubmissions.map((submission) => ({
        id: submission.id,
        reportId: submission.report.id,
        reportName: submission.report.name,
        groupId: submission.group?.id || null,
        groupName: submission.group?.name || null,
        submittedAt: submission.submittedAt,
        submittedBy: {
          id: submission.user.id,
          name: getUserDisplayName(submission.user),
        },
        status: ReportStatus.SUBMITTED,
        data: submission.submissionData.reduce((acc, curr) => {
          acc[curr.reportField.name] = curr.fieldValue;
          return acc;
        }, {}),
        canEdit: false,
      })),
      columns,
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    };
  }

  async getSubmissionDetails(submissionId: number, user: any): Promise<any> {
    const submission = await this.reportSubmissionRepository.findOne({
      where: { id: submissionId },
      relations: [
        'report',
        'user',
        'submissionData',
        'submissionData.reportField',
      ],
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check if user has permission to view this submission
    // TODO: Implement permission check

    const data = submission.submissionData.reduce((acc, curr) => {
      acc[curr.reportField.name] = curr.fieldValue;
      return acc;
    }, {});

    return {
      id: submission.id,
      reportId: submission.report.id,
      reportName: submission.report.name,
      submittedAt: submission.submittedAt,
      submittedBy: getUserDisplayName(submission.user),
      status: ReportStatus.SUBMITTED,
      groupId: submission.group?.id,
      data,
    };
  }

  private async validateUserGroupPermission(
    contactId: number,
    groupId: number,
    categoryId?: number,
  ): Promise<boolean> {
    const membership = await this.groupMembershipRepo.findOne({
      where: {
        contactId,
        group: { id: groupId },
      },
      relations: ['group', 'group.category'],
    });

    if (!membership) return false;
    if (categoryId && membership.group.category?.id !== categoryId)
      return false;

    return true;
  }

  private async getUserGroupsInCategory(
    contactId: number,
    categoryId: number,
  ): Promise<Group[]> {
    const memberships = await this.groupMembershipRepo.find({
      where: {
        contactId,
        group: { category: { id: categoryId } },
      },
      relations: ['group', 'group.category'],
    });

    return memberships.map((membership) => membership.group);
  }

  /**
   * Filter reports based on user's group permissions
   * Users can see reports for categories they have access to via group leadership
   */
  private async filterReportsByUserPermissions(
    reports: Report[],
    user: UserDto,
  ): Promise<Report[]> {
    try {
      // Get user's manageable groups
      const userManageableGroups = await this.getUserManageableGroups(user);

      if (userManageableGroups.length === 0) {
        return []; // No manageable groups = no reports
      }

      // Get categories for these groups (including parent categories)
      const userCategories =
        await this.groupTreeService.getCategoriesForGroups(
          userManageableGroups,
        );

      // Filter reports by target group category
      const accessibleReports = reports.filter((report) => {
        // If report has no target category, user can see it (global report)
        if (!report.targetGroupCategory) {
          return true;
        }

        // Check if user has access to this report's target category
        return userCategories.includes(report.targetGroupCategory.name);
      });

      return accessibleReports;
    } catch (error) {
      console.error('Error filtering reports by user permissions:', error);
      return []; // Return empty array on error for security
    }
  }

  /**
   * Get groups that user can manage (submit reports for)
   */
  private async getUserManageableGroups(user: UserDto): Promise<number[]> {
    try {
      // Get user's direct leadership groups
      const memberships = await this.groupMembershipRepo.find({
        where: {
          contactId: user.contactId,
          role: GroupRole.Leader,
        },
        select: ['groupId'],
      });

      const leadershipGroups = memberships.map((m) => m.groupId);

      // Expand to include all descendant groups
      return await this.groupTreeService.getGroupAndAllChildren(
        leadershipGroups,
      );
    } catch (error) {
      this.logger.error(error, {
        operation: 'getUserManageableGroups',
        userId: user.id,
        contactId: user.contactId,
        resource: 'user_groups',
      });
      return [];
    }
  }

  /**
   * Get groups that user can access for viewing submissions
   */
  private async getUserAccessibleGroups(user: UserDto): Promise<number[]> {
    try {
      // For now, viewable groups = manageable groups
      // In the future, this could be expanded to include view-only permissions
      return await this.getUserManageableGroups(user);
    } catch (error) {
      this.logger.error(error, {
        operation: 'getUserAccessibleGroups',
        userId: user.id,
        contactId: user.contactId,
        resource: 'user_groups',
      });
      return [];
    }
  }
}
