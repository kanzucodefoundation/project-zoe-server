import SearchDto from '../../shared/dto/search.dto';
import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export default class GroupEventSearchDto extends SearchDto {
  parentIdList?: number[];
  groupIdList?: number[];
  categoryIdList?: number[];
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;
}
