import SearchDto from '../../../shared/dto/search.dto';
import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export default class GroupMembershipSearchDto extends SearchDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  groupId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  contactId?: number;
}
