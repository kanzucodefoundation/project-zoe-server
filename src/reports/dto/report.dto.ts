import {
  ReportType,
  ReportFieldType,
  ReportSubmissionFrequency,
} from "../enums/report.enum";

export class ReportFieldDto {
  name: string;
  type: ReportFieldType;
  label: string;
  required: boolean;
  options?: OptionDto[]; // Optional property for radio or checkbox options
}

export class OptionDto {
  label: string;
  value: string;
}

export interface ReportDto {
  name: string;
  description: string;
  type: ReportType;
  fields: ReportFieldDto[];
  columns: ReportColumn[];
  footer: string[];
  submissionFrequency: ReportSubmissionFrequency;
}

interface ReportColumn {
  name: string;
  label: string;
}
