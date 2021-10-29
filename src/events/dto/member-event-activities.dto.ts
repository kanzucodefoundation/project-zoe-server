import { contact } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class MemberEventActivitiesDto {
  activityId: number;
  activity: any;
  contactId: number[];
  contact: any;
}
