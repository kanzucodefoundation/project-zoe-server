import { ReportSubmissionDto } from "../dto/report-submission.dto";

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
  data: Record<string, any>[];
  columns: Record<string, any>;
  footer: string[];
}
