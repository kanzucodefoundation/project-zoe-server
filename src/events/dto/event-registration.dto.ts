import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export default class EventRegistartion {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  eventId: number;
  event: any;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  contactId: number;
  contact: any;
}
