import { GroupPrivacy } from "../enums/groupPrivacy";
import ComboDto from "../../shared/dto/combo.dto";

export default class GroupListDto {
  id: number;
  privacy: GroupPrivacy;
  name: string;
  details?: string;
  categoryId?: number;
  category?: ComboDto;
  parentId?: number;
  parent?: ComboDto;
}
