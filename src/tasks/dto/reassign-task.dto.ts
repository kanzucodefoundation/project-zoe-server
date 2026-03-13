import { IsInt } from 'class-validator';

export class ReassignTaskDto {
  @IsInt()
  assignedToId: number;
}
