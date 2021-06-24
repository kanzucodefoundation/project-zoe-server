import SearchDto from '../../shared/dto/search.dto';
import { IsArray, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactSearchDto extends SearchDto {
  email?: string;
  phone?: string;
  skipUsers?: boolean;

  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsOptional()
  @IsArray()
  cellGroups?: number[];
  
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsOptional()
  @IsArray()
  ageGroups?: number[];

  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsOptional()
  @IsArray()
  churchLocations?: number[];
}
