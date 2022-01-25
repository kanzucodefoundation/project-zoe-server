import { Type } from "class-transformer";
import { IsNumber } from "class-validator";
import SearchDto from "src/shared/dto/search.dto";

export default class EventActivitiesSearchDto extends SearchDto {
  @Type(() => Number)
  @IsNumber()
  eventId?: number;
}
