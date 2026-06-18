import { GroupPrivacy } from '../enums/groupPrivacy';
import { GroupCategoryPurpose } from '../enums/groups';
import ComboDto from '../../shared/dto/combo.dto';

export default class GroupListDto {
  id: number;
  privacy: GroupPrivacy;
  name: string;
  details?: string;
  categoryId?: number;
  category?: ComboDto & { purpose?: GroupCategoryPurpose | null };
  parentId?: number;
  parent?: ComboDto;
}
