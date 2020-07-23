import {IsEnum, IsNotEmpty, IsNumber} from "class-validator";
import { GroupRole } from '../../enums/groupRole';
export default class UpdateGroupMembershipDto {
    @IsNotEmpty()
    @IsNumber()
    id: number;
    
    @IsNumber()
    contactId: number;

    isActive: boolean;
    
    @IsNotEmpty()
    @IsEnum(GroupRole)
    role: GroupRole;
}
