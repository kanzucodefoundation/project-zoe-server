import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupRole } from '../../groups/enums/groupRole';
import Contact from '../entities/contact.entity';

class GroupAssignment {
  @IsNumber()
  id: number; // Group ID

  @IsOptional()
  @IsEnum(GroupRole)
  role?: GroupRole;
}

export class CreateContactWithGroupDto extends Contact {
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Contact must be assigned to at least one group',
  })
  @ValidateNested({ each: true })
  @Type(() => GroupAssignment)
  groups: GroupAssignment[]; // Required - all contacts must have at least one group
}
