import { EventPrivacy } from '../enums/EventPrivacy';
import { EventAttendanceDto } from './event-attendance.dto';
import InternalAddressDto from '../../shared/dto/internal-address-dto';

export default class GroupEventDto {
  id: number;

  privacy: EventPrivacy;

  name: string;

  startDate?: Date;

  endDate?: Date;

  submittedAt?: Date;

  submittedBy?: string;

  details: string;

  venue?: InternalAddressDto;
  attendancePercentage?: string;

  categoryId: string;
  parentId?: number;
  groupId: number;

  group: {
    id: number;
    name: string;
    parentId?: number;
    members: any[];
  };

  metaData?: any;
}
