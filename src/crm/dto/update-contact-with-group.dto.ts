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

class GroupAssignment {
  @IsNumber()
  id: number; // Group ID

  @IsOptional()
  @IsEnum(GroupRole)
  role?: GroupRole;
}

export class UpdateContactWithGroupDto {
  @IsOptional()
  firstName?: string;

  @IsOptional()
  lastName?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  gender?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Contact must be assigned to at least one group',
  })
  @ValidateNested({ each: true })
  @Type(() => GroupAssignment)
  groups?: GroupAssignment[]; // Optional for updates, but if provided, must have at least one group
}
