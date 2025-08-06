import { GroupPrivacy } from "../enums/groupPrivacy";
import ComboDto from "../../shared/dto/combo.dto";

export class GroupDetailDto {
  id: number;
  privacy: GroupPrivacy;
  name: string;
  details: string;
  categoryId?: number;
  category: ComboDto;
  parentId?: number;
  parent?: ComboDto;
  metaData?: string;
  address?: any;
  leaders?: number[];
  parents?: any;
  children?: any;
}
