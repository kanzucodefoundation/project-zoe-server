import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { GroupRole } from '../../enums/groupRole';

export default class BatchGroupMembershipDto {
  @IsNotEmpty()
  @IsNumber()
  groupId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  members: number[];

  @IsEnum(GroupRole)
  role?: GroupRole;
}
