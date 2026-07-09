import { IsDefined, IsObject, IsNumber, IsOptional } from 'class-validator';

export class ReportSubmissionDto {
  @IsDefined()
  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsNumber()
  selectedGroupId?: number;
}
