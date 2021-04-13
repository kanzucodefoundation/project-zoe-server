import SearchDto from '../../shared/dto/search.dto';
import { IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export default class GroupEventSearchDto extends SearchDto {
  parentIdList?: number[];
  groupIdList?: number[];
  categoryIdList?: string[];
  @IsDate()
  @Type(() => Date)
  from?: Date;
  @IsDate()
  @Type(() => Date)
  to?: Date;
}
