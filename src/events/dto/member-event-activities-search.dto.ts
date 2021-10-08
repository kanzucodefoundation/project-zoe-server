import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import SearchDto from 'src/shared/dto/search.dto';

export default class  MemberEventActivitiesSearchDto extends SearchDto {
  @Type(() => Number)
  @IsNumber()
  activitiesId?: number;
  @Type(() => Number)
  @IsNumber()
  contactId?: number;

}
