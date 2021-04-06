import { GroupRole } from '../../enums/groupRole';
import ComboDto from '../../../shared/dto/combo.dto';

export default class GroupMembershipDto {
  id: number;
  group: ComboDto;
  groupId: number;
  contact: ComboDto;
  contactId: number;
  role: GroupRole;
  category?: ComboDto;
}
