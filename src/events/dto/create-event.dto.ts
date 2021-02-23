import { EventPrivacy } from '../enums/EventPrivacy';
import { EventAttendanceDto } from './event-attendance.dto';
import InternalAddressDto from '../../shared/dto/internal-address-dto';

export default class CreateEventDto {
  privacy: EventPrivacy;

  name: string;

  startDate?: Date;

  endDate?: Date;

  submittedAt?: Date;

  submittedBy?: string;

  details: string;

  venue?: InternalAddressDto;

  categoryId: string;
  groupId?: number;

  attendance: EventAttendanceDto[];

  metaData?: any;
}
