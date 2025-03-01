import { ReportSubmissionDto } from "../dto/report-submission.dto";
import { ReportType } from "../enums/report.enum";

export interface ReportSubmissionDataDto {
  reportId: number;
  submissionId: number;
  submittedAt: Date;
  submittedBy: string;
}

export interface ApiResponse<T> {
  data: T;
  status?: number;
  message?: string;
}

export interface ReportSubmissionsApiResponse {
  reportId: number;
  viewType: string;
  data: Record<string, any>[];
  columns: Record<string, any>;
  footer: string[];
}
