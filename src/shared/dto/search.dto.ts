import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export default class SearchDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  // When true (with purpose), returns all groups of that purpose under the
  // requesting user's own location, regardless of their leader/member access
  // to those specific groups.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  sameLocation?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limit?: number = 100;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number = 0;
}
