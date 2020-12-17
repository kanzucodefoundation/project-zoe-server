import SearchDto from '../../../shared/dto/search.dto';

export default class GroupMembershipSearchDto extends SearchDto {
  groupId?: number;
  contactId?: number;
}
