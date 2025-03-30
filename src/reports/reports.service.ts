import {
  Injectable,
  Inject,
  NotFoundException,
  HttpStatus,
} from "@nestjs/common";
import { Connection, Repository, In } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { Report } from "./entities/report.entity";
import { ReportSubmission } from "./entities/report.submission.entity";
import { ReportSubmissionDto } from "./dto/report-submission.dto";
import { ReportDto } from "./dto/report.dto";
import { User } from "src/users/entities/user.entity";
import { IEmail, sendEmail } from "src/utils/mailer";
import {
  getUserDisplayName,
  getHumanReadableDate,
} from "src/utils/stringHelpers";

import {
  ReportSubmissionsApiResponse,
  ApiResponse,
  ReportSubmissionDataDto,
} from "./types/report-api.types";
import { TreeRepository } from "typeorm";
import Group from "src/groups/entities/group.entity";
import { UsersService } from "src/users/users.service";
import { GroupsService } from "src/groups/services/groups.service";
import { ReportField } from "./entities/report.field.entity";
import { ReportSubmissionData } from "./entities/report.submission.data.entity";
import { GroupCategoryNames } from "src/groups/enums/groups";

@Injectable()
export class ReportsService {
  private readonly reportRepository: Repository<Report>;
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly reportSubmissionDataRepository: Repository<ReportSubmissionData>;
  private readonly userRepository: Repository<User>;
  private readonly reportFieldRepository: Repository<ReportField>;
  private readonly treeRepository: TreeRepository<Group>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private readonly usersService: UsersService,
    private readonly groupsService: GroupsService,
  ) {
    this.reportRepository = connection.getRepository(Report);
    this.reportFieldRepository = connection.getRepository(ReportField);
    this.reportSubmissionDataRepository =
      connection.getRepository(ReportSubmissionData);
    this.reportSubmissionRepository =
      connection.getRepository(ReportSubmission);
    this.treeRepository = connection.getTreeRepository(Group);
    this.userRepository = connection.getRepository(User);
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
      where: { id: reportId },
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

    // Create and save the report submission
    const reportSubmission = new ReportSubmission();
    reportSubmission.report = report;
    reportSubmission.submittedAt = new Date();
    reportSubmission.user = submittingUser;
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
      message: "Report submitted successfully.",
    };

    // Send confirmation email (assuming sendMail is an asynchronous operation)
    const formattedDate = getHumanReadableDate(savedSubmission.submittedAt);
    const fullName = getUserDisplayName(savedSubmission.user);
    await this.sendMail(
      savedSubmission.user.username,
      "Project Zoe - Report Submitted",
      { submissionDate: formattedDate, fullName },
    );

    return response;
  }

  async getAllReports(): Promise<Report[]> {
    return await this.reportRepository.find({ relations: ["fields"] });
  }

  async getReport(reportId: number): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ["fields"],
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
      relations: ["fields", "submissions"],
    });

    console.log("report", report);

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    // For now, all the reports are aggregate reports.
    switch (report.functionName) {
      case "getSmallGroupSummaryAttendance":
        return this.getSmallGroupSummaryAttendance(
          report,
          startDate,
          endDate,
          smallGroupIdList,
          parentGroupIdList,
        );
      case "getSmallGroupReportSubmissionStatus":
        return this.getSmallGroupReportSubmissionStatus(
          report,
          startDate,
          endDate,
        );
      default:
        return this.getGenericReport(
          report,
          startDate,
          endDate,
          smallGroupIdList,
          parentGroupIdList,
        );
    }
  }

  private async buildSubmissionQuery(
    reportId: number,
    startDate: Date,
    endDate: Date,
    smallGroupIds?: number[],
  ) {
    let query = this.reportSubmissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.report", "report")
      .leftJoinAndSelect("submission.user", "user")
      .leftJoinAndSelect("submission.submissionData", "submissionData")
      .leftJoinAndSelect("submissionData.reportField", "reportField")
      .where("report.id = :reportId", { reportId })
      .andWhere("submission.submittedAt BETWEEN :startDate AND :endDate", {
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

  async getGenericReport(
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
      smallGroupIds = smallGroupIdList.split(",").map(Number); // Convert CSV to an array of numbers
    }

    if (parentGroupIdList && parentGroupIdList.length) {
      const parentGroupIds = Array.isArray(parentGroupIdList)
        ? parentGroupIdList
        : [parentGroupIdList];
      const smallGroupEntities = await this.treeRepository.find({
        select: ["id"],
        where: { parentId: In(parentGroupIds) },
      });
      smallGroupIds = smallGroupEntities.map((smallGroup) => smallGroup.id);
    }

    let query = await this.buildSubmissionQuery(
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
          (sd) => sd.reportField.name === "smallGroupId",
        );

        // Ensure we handle the case where smallGroupFieldData might be undefined
        if (smallGroupFieldData) {
          const smallGroup = await this.treeRepository.findOne({
            where: { id: parseInt(smallGroupFieldData.fieldValue) },
            relations: ["parent"],
          });

          // Add the small group parent
          transformedData["parentGroupName"] = smallGroup?.parent?.name || "";
        }

        // Aggregate submission data into a single object
        submission.submissionData.forEach((sd) => {
          transformedData[sd.reportField.name] = sd.fieldValue;
        });

        return transformedData;
      }),
    );

    const reportColumns = Object.values(report.displayColumns); // Convert columns object to array

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: "Submitted At", name: "submittedAt" },
        { label: "Submitted By", name: "submittedBy" },
      ],
      footer: report.footer,
    };
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
      smallGroupIds = smallGroupIdList.split(",").map(Number); // Convert CSV to an array of numbers
    }

    if (parentGroupIdList && parentGroupIdList.length) {
      const parentGroupIds = Array.isArray(parentGroupIdList)
        ? parentGroupIdList
        : [parentGroupIdList];
      const smallGroupEntities = await this.treeRepository.find({
        select: ["id"],
        where: { parentId: In(parentGroupIds) },
      });
      smallGroupIds = smallGroupEntities.map((smallGroup) => smallGroup.id);
    }

    let query = await this.buildSubmissionQuery(
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
          (sd) => sd.reportField.name === "smallGroupId",
        );

        // Ensure we handle the case where smallGroupFieldData might be undefined
        if (smallGroupFieldData) {
          const smallGroup = await this.treeRepository.findOne({
            where: { id: parseInt(smallGroupFieldData.fieldValue) },
            relations: ["parent"],
          });

          // Add the small group parent
          transformedData["parentGroupName"] = smallGroup?.parent?.name || "";
        }

        // Aggregate submission data into a single object
        submission.submissionData.forEach((sd) => {
          transformedData[sd.reportField.name] = sd.fieldValue;
        });

        return transformedData;
      }),
    );

    const reportColumns = Object.values(report.displayColumns); // Convert columns object to array

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: "Submitted At", name: "submittedAt" },
        { label: "Submitted By", name: "submittedBy" },
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
    let query = await this.buildSubmissionQuery(
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
            sd.reportField.name === "smallGroupId" &&
            sd.fieldValue === group.id.toString(),
        ),
      );

      const isSubmitted = !!submission;
      const smallGroupFieldData = submission?.submissionData.find(
        (sd) => sd.reportField.name === "smallGroupId",
      );

      return {
        smallGroupName: group.name,
        weekNumber,
        reportSubmissionStatus: isSubmitted ? "Submitted" : "Not Submitted",
        submittedAt: isSubmitted ? submission.submittedAt.toISOString() : "-",
        submittedBy: isSubmitted ? getUserDisplayName(submission.user) : "-",
        missingReports: isSubmitted ? 0 : 1,
      };
    });

    const reportColumns = Object.values(report.displayColumns);

    return {
      reportId: report.id,
      data: submissionResponses,
      columns: [
        ...reportColumns,
        { label: "Submitted At", name: "submittedAt" },
        { label: "Submitted By", name: "submittedBy" },
      ],
      footer: report.footer,
    };
  }

  async getReportSubmission(reportId: number, submissionId: number) {
    // Fetch the submission with its related user and submissionData (including the reportField for each submissionData)
    const submission = await this.reportSubmissionRepository.findOne({
      where: { id: submissionId, report: { id: reportId } },
      relations: ["user", "submissionData", "submissionData.reportField"],
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
      relations: ["fields"],
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
      relations: ["fields", "submissions"],
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
      const zoneName = report.parentGroupName || "Other"; // Use 'Other' as the default zone name if not specified
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
            ${columns.map((column) => `<th>${column.label}</th>`).join("")}
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
              .join("")}
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

    const usersWithRole = await this.usersService.findByRole("Report Champion");
    const emailAddresses = usersWithRole.map((user) => user.username);
    if (!emailAddresses.length) {
      return "Error | Weekly email not sent";
    }
    const mailerData = {
      to: emailAddresses.join(", "),
      subject: "Project Zoe | Weekly MC Reports Submitted",
      html: fullHTML,
    };

    sendEmail(mailerData);
    return "Weekly email sent successfully";
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
}
