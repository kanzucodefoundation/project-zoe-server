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

export class ReportColumnDto {
  fieldName: string;
  label: string;
}

export class OptionDto {
  label: string;
  value: string;
}

export class ReportDto {
  name: string;
  description?: string;
  type: ReportType;
  fields: ReportFieldDto[];
  columns?: ReportColumnDto[];
  footer?: string[];
  submissionFrequency: ReportSubmissionFrequency;
}
