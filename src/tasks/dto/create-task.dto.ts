import { IsEnum, IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { TaskType } from '../enums/task-type.enum';

export class CreateTaskDto {
  @IsInt()
  contactId: number;

  @IsEnum(TaskType)
  type: TaskType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
