export default class GroupMembershipRequestDto {

    id: number;
    contactId: number;
    parentId?: number;
    groupId: number;
    distanceKm?: number;
    group: {
        id: number;
        name: string;
        parentId?: number;
    };
    contact: {
        id: number;
        fullName: string;
        avatar: string;
    }
}


