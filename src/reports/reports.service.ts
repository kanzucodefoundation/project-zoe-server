import {
  Injectable,
  Inject,
  NotFoundException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, In } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { EventCategories } from "src/events/enums/EventCategories";
import { Report } from "./entities/report.entity";
import { ReportSubmission } from "./entities/report.submission.entity";
import { ReportSubmissionDto } from "./dto/report-submission.dto";
import { ReportDto, ReportFieldDto } from "./dto/report.dto";
import { UpdateDto } from "./dto/update.dto";
import { User } from "src/users/entities/user.entity";
import { IEmail, sendEmail } from "src/utils/mailer";
import {
  getUserDisplayName,
  getHumanReadableDate,
} from "src/utils/stringHelpers";

import {
  ReportSubmissionsApiResponse,
  ApiResponse,
  ReportSubmissionData,
} from "./types/report-api.types";
import { ReportFieldType } from "./enums/report.enum";
import { TreeRepository } from "typeorm";
import Group from "src/groups/entities/group.entity";

@Injectable()
export class ReportsService {
  private readonly reportRepository: Repository<Report>;
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly userRepository: Repository<User>;
  private readonly treeRepository: TreeRepository<Group>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.reportRepository = connection.getRepository(Report);
    this.reportSubmissionRepository =
      connection.getRepository(ReportSubmission);
    this.treeRepository = connection.getTreeRepository(Group);
    this.userRepository = connection.getRepository(User);
  }

  async createReport(reportDto: ReportDto, user: UserDto): Promise<Report> {
    const report = new Report();
    report.name = reportDto.name;
    report.description = reportDto.description;
    report.type = reportDto.type;
    report.fields = reportDto.fields;
    report.columns = reportDto.columns;
    report.footer = reportDto.footer;
    report.submissionFrequency = reportDto.submissionFrequency;
    report.user = await this.userRepository.findOne({ where: { id: user.id } });

    return this.reportRepository.save(report);
  }

  async submitReport(
    submissionDto: ReportSubmissionDto,
    user: UserDto,
  ): Promise<ApiResponse<ReportSubmissionData>> {
    const { reportId, data } = submissionDto;
    // Retrieve the report by its ID
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    // Check if the report exists
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const reportSubmission = new ReportSubmission();
    reportSubmission.data = submissionDto.data;
    reportSubmission.submittedAt = new Date();
    reportSubmission.report = report;
    reportSubmission.user = await this.userRepository.findOne({
      where: { id: user.id },
    });
    try {
      // Attempt to save the report submission
      const submissionSaveResult =
        await this.reportSubmissionRepository.save(reportSubmission);
      if (!submissionSaveResult) {
        throw new HttpException(
          "Report submission was not saved.",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const apiResponse: ApiResponse<ReportSubmissionData> = {
        data: {
          reportId: submissionSaveResult.report.id,
          submissionId: submissionSaveResult.id,
          submittedAt: submissionSaveResult.submittedAt,
          submittedBy: submissionSaveResult.user.username,
        },
        status: HttpStatus.OK,
        message: "Report submitted successfully.",
      };
      const formattedDate = getHumanReadableDate(
        submissionSaveResult.submittedAt,
      );
      const fullName = getUserDisplayName(submissionSaveResult.user);
      this.sendMail(
        submissionSaveResult.user.username,
        "Project Zoe - Report Submitted",
        { submissionDate: formattedDate, fullName },
      );
      return apiResponse;
    } catch (error) {
      // Handle and rethrow the exception
      throw new HttpException(
        "Failed to save report submission.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllReports(): Promise<Report[]> {
    return await this.reportRepository.find();
  }

  async getReport(reportId: number): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }
    return report;
  }

  async getReportSubmissions(
    reportId: number,
    startDate?: Date,
    endDate?: Date,
    smallGroupIdList?: string,
    parentGroupIdList?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    return this.getSmallGroupSummaryAttendance(
      reportId,
      report,
      startDate,
      endDate,
      smallGroupIdList,
      parentGroupIdList,
    );
  }

  async getSmallGroupSummaryAttendance(
    reportId: number,
    report: Report,
    startDate?: Date,
    endDate?: Date,
    smallGroupIdList?: string,
    parentGroupIdList?: string,
  ): Promise<ReportSubmissionsApiResponse> {
    let query = this.reportSubmissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.report", "report")
      .leftJoinAndSelect("submission.user", "user")
      .leftJoinAndSelect("user.contact", "contact")
      .leftJoinAndSelect("contact.person", "person")
      .where("report.id = :reportId", { reportId });

    if (startDate && endDate) {
      query = query.andWhere(
        "submission.submittedAt BETWEEN :startDate AND :endDate",
        { startDate, endDate },
      );
    } else if (startDate) {
      query = query.andWhere("submission.submittedAt >= :startDate", {
        startDate,
      });
    } else if (endDate) {
      query = query.andWhere("submission.submittedAt <= :endDate", { endDate });
    }
    if (smallGroupIdList) {
      const smallGroupIds = smallGroupIdList.split(",").map(Number); // Convert CSV to an array of numbers
      query = query.andWhere(
        "CAST(submission.data ->> 'smallGroupId' AS INTEGER) IN (:...smallGroupIds)",
        {
          smallGroupIds,
        },
      );
    }

    if (parentGroupIdList && parentGroupIdList.length) {
      const parentGroupIds = Array.isArray(parentGroupIdList)
        ? parentGroupIdList
        : [parentGroupIdList];
      const smallGroupEntities = await this.treeRepository.find({
        select: ["id"],
        where: { parentId: In(parentGroupIds) },
      });
      const smallGroupIds = smallGroupEntities.map(
        (smallGroup) => smallGroup.id,
      );
      query = query.andWhere(
        "CAST(submission.data ->> 'smallGroupId' AS INTEGER) IN (:...smallGroupIds)",
        {
          smallGroupIds,
        },
      );
    }

    const submissions: ReportSubmission[] = await query.getMany();
    const submissionResponses = await Promise.all(
      submissions.map(async (submission) => {
        const { id, data, submittedAt, user } = submission;
        const displayName = getUserDisplayName(user);

        const smallGroup = await this.treeRepository.findOne({
          where: { id: data.smallGroupId },
          relations: ["parent"],
        });

        return {
          id,
          ...data,
          submittedAt,
          submittedBy: displayName,
          parentGroupName: smallGroup?.parent?.name || "", // Use optional chaining to avoid potential errors
        };
      }),
    );

    const reportColumns = Object.values(report.columns); // Convert columns object to array

    return {
      reportId,
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
    const submission = await this.reportSubmissionRepository.findOne({
      where: { id: submissionId, report: { id: reportId } },
      relations: ["user"],
    });

    if (!submission) {
      throw new NotFoundException(
        `Report submission with ID ${submissionId} not found`,
      );
    }

    const reportDetails = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    const { fields } = reportDetails;

    const { id, data, submittedAt, user } = submission;

    return {
      id,
      data,
      labels: fields.map((field: ReportFieldDto) => {
        const { name, label } = field;
        return { name, label };
      }),
      submittedAt,
      submittedBy: user ? user.username : null,
    };
  }

  async updateReport(id: number, updateDto: ReportDto): Promise<Report | any> {
    return await this.reportRepository.update(id, updateDto);
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

  // @TODO Placeholder. Replace this logic.
  getReportFunction(reportFunctionName: string, reportArgs: any) {
    const reportFunctionsMap = new Map<string, (reportArgs: any) => any>();
    //reportFunctionsMap.set('smallGroupWeeklyAttendanceMissingReports', this.generateReport1(reportArgs));
  }

  generateReport1(reportArgs: any) {
    return [];
  }
}
