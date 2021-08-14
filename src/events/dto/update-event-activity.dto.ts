import { PartialType } from '@nestjs/mapped-types';

import { CreateEventActivityDto } from './create-event-activity.dto';

export class UpdateEventActivityDto {
  

  id: number;
  name:string;
  eventId:number;
}
