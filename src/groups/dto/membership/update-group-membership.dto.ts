import {IsEnum, IsNotEmpty, IsNumber} from "class-validator";
import { GroupRole } from '../../enums/groupRole';
export default class UpdateGroupMembershipDto {
    @IsNotEmpty()
    @IsNumber()
    id: number;

    // Added by Daniel
    @IsNotEmpty()
    groupId: number;
    @IsNotEmpty()
    @IsNumber()
    contactId: number;
    //END
    
    @IsNotEmpty()
    @IsEnum(GroupRole)
    role: GroupRole;
}
