import SearchDto from '../../shared/dto/search.dto';

export class GroupMissingReportSearchDto extends SearchDto {
  parentIdList?: number[];
  reportFreqList?: string[];
  categoryIdList?: string[];
  from?: Date;
  to?: Date;
}
