import ComboDto from 'src/shared/dto/combo.dto';

export default class GroupMembershipRequestDto {
  id: number;
  contactId: number;
  parentId?: number;
  groupId: number;
  distanceKm?: number;
  group: {
    id: number;
    name: string;
    parent?: ComboDto;
  };
  contact: {
    id: number;
    fullName: string;
    avatar: string;
  };
}
