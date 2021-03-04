import { IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export default class SearchDto {
  query?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limit: number = 100;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip: number = 0;
}
