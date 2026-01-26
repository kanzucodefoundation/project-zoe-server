import SearchDto from '../../../shared/dto/search.dto';

export default class GroupMembershipRequestSearchDto extends SearchDto {
  groupId?: number;
  contactId?: number;
}
