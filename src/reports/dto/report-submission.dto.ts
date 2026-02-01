import { IsDefined, IsObject } from 'class-validator';

export class ReportSubmissionDto {
  @IsDefined()
  @IsObject()
  data: Record<string, any>;
}
