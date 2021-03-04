import SearchDto from '../../shared/dto/search.dto';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export default class EventAttendanceSearchDto extends SearchDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eventId?: number;
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  groupId?: number;
}
