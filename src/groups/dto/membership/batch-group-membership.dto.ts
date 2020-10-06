import { IsArray, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { GroupRole } from '../../enums/groupRole';
export default class BatchGroupMembershipDto {
    @IsNotEmpty()
    @IsNumber()
    groupId: number;

    @IsArray()
    members: number[];

    @IsEnum(GroupRole)
    role?: GroupRole;
}
