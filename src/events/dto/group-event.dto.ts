import { EventPrivacy } from '../enums/EventPrivacy';
import { EventAttendanceDto } from './event-attendance.dto';
import InternalAddressDto from '../../shared/dto/internal-address-dto';
import ComboDto from 'src/shared/dto/combo.dto';
import EventField from '../entities/eventField.entity';

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

  categoryId: number;
  category?: ComboDto;
  categoryFields?: EventField[];
  
  parentId?: number;
  groupId: number;

  group: {
    id: number;
    name: string;
    parentId?: number;
    members: any[];
  };
  attendance: any[];
  metaData?: any;
}
