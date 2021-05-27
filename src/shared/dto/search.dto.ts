import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export default class SearchDto {
  @IsString()
  @IsOptional()
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
