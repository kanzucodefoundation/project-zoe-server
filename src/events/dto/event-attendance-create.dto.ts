import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class EventAttendanceCreateDto {
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @Type(() => Boolean)
  @IsBoolean()
  isVisitor: boolean;

  @IsNotEmpty()
  @Type(() => Boolean)
  @IsBoolean()
  attended: boolean;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  eventId: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  contactId: number;
}
