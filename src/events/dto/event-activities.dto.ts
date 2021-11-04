import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class EventActivititiesDto {
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @Type(() => Boolean)
  @IsBoolean()
  name: boolean;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eventId: number;
  //event: any;
 
}
