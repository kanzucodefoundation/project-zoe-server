import SearchDto from '../../../shared/dto/search.dto';

export default class GroupMembershipRequestSearchDto extends SearchDto {
    parentId?: number;
    groupId?: number;
    contactId?: number;
}


