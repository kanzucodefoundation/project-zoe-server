import SearchDto from "../../shared/dto/search.dto";

export class GroupSearchDto extends SearchDto {
  categories: number[] = [];
}
