import { IsDefined, IsObject } from "class-validator";

export class ReportSubmissionDto {
  reportId: number;

  @IsDefined()
  @IsObject()
  data: Record<string, any>;
}
