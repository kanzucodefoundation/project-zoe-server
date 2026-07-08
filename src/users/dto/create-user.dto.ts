import { IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { GroupRole } from '../../groups/enums/groupRole';

export class CreateUserDto {
  @IsNotEmpty()
  @IsNumber()
  contactId: number;

  @IsOptional()
  username?: string;
  @IsNotEmpty()
  password: string;
  @IsNotEmpty()
  roles: string[];
  @IsNotEmpty()
  isActive: boolean;

  @IsOptional()
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsEnum(GroupRole)
  groupRole?: GroupRole;
}
