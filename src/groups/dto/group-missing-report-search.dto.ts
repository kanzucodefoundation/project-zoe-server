import SearchDto from '../../shared/dto/search.dto';

export class GroupMissingReportSearchDto extends SearchDto {
  //TODO @Herbert, add validation for both string and number arrays( @Type(() => Number) @IsNumber({}, { each: true }) @IsOptional() @IsArray()) //
  parentIdList?: number[];
  reportFreqList?: string[];
  categoryIdList?: string[];
  from?: Date;
  to?: Date;
}
