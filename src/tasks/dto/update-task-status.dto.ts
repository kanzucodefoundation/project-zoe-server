import { IsEnum, IsOptional, IsDateString, IsInt, IsString } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  // Required when status = ATTENDED_FELLOWSHIP or JOINED_SERVING_TEAM
  @IsOptional()
  @IsInt()
  groupId?: number;

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  // Required when status = GOT_BAPTISED
  @IsOptional()
  @IsDateString()
  baptismDate?: string;

  @IsOptional()
  @IsString()
  baptismLocation?: string;

  @IsOptional()
  @IsString()
  baptismOfficiant?: string;
}
