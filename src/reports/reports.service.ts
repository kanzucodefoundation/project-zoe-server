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

  async getReports(groupId?: number, submissionDate?: string): Promise<any[]> {
    const query = this.reportRepository.createQueryBuilder("report");

    if (groupId) {
      query
        .innerJoin("report.tenant", "tenant")
        .where("tenant.group = :groupId", { groupId });
    }

    if (submissionDate) {
      const start = new Date(submissionDate);
      const end = new Date(submissionDate);
      end.setDate(end.getDate() + 1);
      query
        .innerJoin("report.submissions", "submission")
        .where("submission.submittedAt >= :start", { start })
        .andWhere("submission.submittedAt < :end", { end });
    }

    const reports = await query.getMany();
    const response = [];

    for (const report of reports) {
      const submissions = await this.reportSubmissionRepository.find({
        report: report,
      });
      const reportData = {
        id: report.id,
        name: report.name,
        type: report.type,
        submissions: submissions.map((submission) => ({
          id: submission.id,
          data: submission.data,
          submittedAt: submission.submittedAt,
        })),
      };
      response.push(reportData);
    }

    return response;
  }

  //async updateReport(id: number, updateDto: Partial<ReportDto>): Promise<void> {
  //  await this.reportRepository.update(id, updateDto);
  //}
}
