import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}
