import { ReportSubmissionDto } from "../dto/report-submission.dto";

export interface ApiResponse<T> {
  data: T;
  status?: number;
  message?: string;
}

export interface ReportSubmissionsApiResponse {
  data: Record<string, any>[];
  columns: Record<string, any>;
  footer: string[];
}
