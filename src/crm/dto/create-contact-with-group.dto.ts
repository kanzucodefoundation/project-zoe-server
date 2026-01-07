import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { GroupRole } from '../../groups/enums/groupRole';
import Contact from '../entities/contact.entity';

export class CreateContactWithGroupDto extends Contact {
  @IsOptional()
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsEnum(GroupRole)
  role?: GroupRole;
}
