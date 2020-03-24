import SearchDto from '../../shared/dto/search.dto';

export class ContactSearchDto extends SearchDto {
  email?: string;
  phone?: string;
  cellGroups?: number[];
  ageGroups?: number[];
  churchLocations?: number[];
}
