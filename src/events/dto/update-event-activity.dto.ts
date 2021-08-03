import { PartialType } from '@nestjs/mapped-types';
import { CreateEventActivityDto } from './create-event-activity.dto';

export class UpdateEventActivityDto extends PartialType(CreateEventActivityDto) {}
