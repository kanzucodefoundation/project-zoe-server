import SearchDto from '../../shared/dto/search.dto';
import { IsArray, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactSearchDto extends SearchDto {
  email?: string;
  phone?: string;

  @Type(() => Number)
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  cellGroups?: number[];

  @Type(() => Number)
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  ageGroups?: number[];
  churchLocations?: number[];
  skipUsers?: boolean;
}
