import { IsNotEmpty, IsOptional } from 'class-validator';
import { GroupCategoryReportFrequency } from '../enums/groupCategoryReportFrequency ';

export default class CrGroupCatReportDto {
  @IsOptional()
  id?: number;
  @IsNotEmpty()
  groupCategoryId: string;
  @IsNotEmpty()
  eventCategoryId: string;
  @IsNotEmpty()
  frequency: GroupCategoryReportFrequency;
}
