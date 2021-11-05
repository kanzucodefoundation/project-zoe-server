import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateMemberEventActivitiesDto {
  activityId: number;
  contactId: number[];
}
