import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { GroupRole } from '../../enums/groupRole';

export default class UpdateGroupMembershipDto {
  @IsNumber()
  id: number;
  @IsNotEmpty()
  @IsEnum(GroupRole)
  role: GroupRole;
}
