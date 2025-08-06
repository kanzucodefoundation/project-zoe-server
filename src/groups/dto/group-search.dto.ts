import SearchDto from "../../shared/dto/search.dto";
import GroupCategory from "../entities/groupCategory.entity";

export class GroupSearchDto extends SearchDto {
  categories: string[] = [];
}
