import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, FindConditions } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { EventCategories } from "src/events/enums/EventCategories";
import { Report } from "./entities/report.entity";
import { ReportSubmission } from "./entities/report.submission.entity";
import { ReportSubmissionDto } from "./dto/report-submission.dto";
import { ReportDto, ReportFieldDto } from "./dto/report.dto";
import { UpdateDto } from "./dto/update.dto";
import { User } from "src/users/entities/user.entity";
import { ReportSubmissionsApiResponse } from "./types/report-api.types";
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
    this.reportSubmissionRepository = connection.getRepository(
      ReportSubmission,
    );
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
    report.user = await this.userRepository.findOne(user.id);

    return this.reportRepository.save(report);
  }

  async submitReport(
    submissionDto: ReportSubmissionDto,
    user: UserDto,
  ): Promise<void> {
    const { reportId, data } = submissionDto;
    // Retrieve the report by its ID
    const report = await this.reportRepository.findOne(reportId);
    // Check if the report exists
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const reportSubmission = new ReportSubmission();
    reportSubmission.data = submissionDto.data;
    reportSubmission.submittedAt = new Date();
    reportSubmission.report = report;
    reportSubmission.user = await this.userRepository.findOne(user.id);
    await this.reportSubmissionRepository.save(reportSubmission);
  }

  async getAllReports(): Promise<Report[]> {
    return await this.reportRepository.find();
  }

  async getReport(reportId: number): Promise<Report> {
    const report = await this.reportRepository.findOne(reportId);
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
  ): Promise<ReportSubmissionsApiResponse> {
    const report = await this.reportRepository.findOne(reportId);
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    return this.getSmallGroupSummaryAttendance(
      reportId,
      report,
      startDate,
      endDate,
      smallGroupIdList,
    );
  }

  async getSmallGroupSummaryAttendance(
    reportId: number,
    report: Report,
    startDate?: Date,
    endDate?: Date,
    smallGroupIdList?: string,
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

    const submissions: ReportSubmission[] = await query.getMany();
    const submissionResponses = await Promise.all(
      submissions.map(async (submission) => {
        const { id, data, submittedAt, user } = submission;
        const firstName = user?.contact?.person?.firstName ?? "";
        const lastName = user?.contact?.person?.lastName ?? "";
        const fullName = `${firstName} ${lastName}`;
        const displayName =
          fullName.trim() !== "" ? fullName : user ? user.username : "";

        const smallGroup = await this.treeRepository.findOne(
          data.smallGroupId,
          {
            relations: ["parent"],
          },
        );

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

    const reportDetails = await this.reportRepository.findOne(reportId);
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

  // @TODO Placeholder. Replace this logic.
  getReportFunction(reportFunctionName: string, reportArgs: any) {
    const reportFunctionsMap = new Map<string, (reportArgs: any) => any>();
    //reportFunctionsMap.set('smallGroupWeeklyAttendanceMissingReports', this.generateReport1(reportArgs));
  }

  generateReport1(reportArgs: any) {
    return [];
  }
}
