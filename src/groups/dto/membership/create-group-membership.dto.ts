import {IsEnum, IsNotEmpty, IsNumber} from "class-validator";
import {GroupRole} from "../../enums/groupRole";

export  class CreateGroupMembershipDto {
    @IsNotEmpty()
    groupId: number;
    @IsNotEmpty()
    @IsNumber()
    contactId: number;
    @IsNotEmpty()
    @IsEnum(GroupRole)
    role: GroupRole;
}
