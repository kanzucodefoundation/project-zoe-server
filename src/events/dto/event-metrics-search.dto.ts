import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';

export default class EventMetricsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  groupId?: number;

  groupIdList?: number[];
  categoryIdList?: string[];

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;
}
