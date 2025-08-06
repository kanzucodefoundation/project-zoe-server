import { ReportType } from "../enums/report.enum";

export class UpdateDto {
  name?: string;
  type?: ReportType;
  fields?: string[];
  headers?: string[];
  footer?: string;
}
