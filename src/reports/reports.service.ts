import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, FindConditions } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { EventCategories } from "src/events/enums/EventCategories";
import { Report } from "./entities/report.entity";
import { ReportSubmission } from "./entities/report.submission.entity";
import { ReportSubmissionDto } from "./dto/report-submission.dto";
import { ReportDto } from "./dto/report.dto";
import { UpdateDto } from "./dto/update.dto";
import { User } from "src/users/entities/user.entity";
import { ReportSubmissionsApiResponse } from "./types/report-api.types";

@Injectable()
export class ReportsService {
  private readonly reportRepository: Repository<Report>;
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly userRepository: Repository<User>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.reportRepository = connection.getRepository(Report);
    this.reportSubmissionRepository = connection.getRepository(
      ReportSubmission,
    );
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
  ): Promise<ReportSubmissionsApiResponse> {
    const report = await this.reportRepository.findOne(reportId);
    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }
    let query = this.reportSubmissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.report", "report")
      .leftJoinAndSelect("submission.user", "user")
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

    const submissions: ReportSubmission[] = await query.getMany();

    const submissionResponses = submissions.map((submission) => {
      const { id, data, submittedAt, user } = submission;
      return {
        id,
        data: {
          ...data,
          submittedAt,
          submittedBy: user ? user.username : "",
        },
      };
    });

    const reportColumns = Object.values(report.columns); // Convert columns object to array

    return {
      reportId,
      data: submissionResponses.map((submission) => submission.data),
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

    const { id, data, submittedAt, user } = submission;

    return {
      id,
      data,
      submittedAt,
      submittedBy: user ? user.username : null,
    };
  }
  //async updateReport(id: number, updateDto: Partial<ReportDto>): Promise<void> {
  //  await this.reportRepository.update(id, updateDto);
  //}
}
