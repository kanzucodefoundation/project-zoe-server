import SearchDto from '../../shared/dto/search.dto';
import { IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactSearchDto extends SearchDto {
  email?: string;
  phone?: string;

  @Type(() => Number)
  @IsArray()
  @IsNumber({}, { each: true })
  cellGroups?: number[];

  @Type(() => Number)
  @IsArray()
  @IsNumber({}, { each: true })
  ageGroups?: number[];
  churchLocations?: number[];
  skipUsers?: boolean;
}
