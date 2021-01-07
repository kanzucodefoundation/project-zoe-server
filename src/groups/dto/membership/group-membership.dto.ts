import {GroupRole} from "../../enums/groupRole";
import ComboDto from "../../../shared/dto/combo.dto";

export default class GroupMembershipDto {
    id: number;
    group: ComboDto;
    groupId: number;
    groupDetails: string;
    contact: ComboDto;
    contactId: number;
    role: GroupRole;
}

