import { GroupPrivacy } from '../enums/groupPrivacy';
import ComboDto from '../../shared/dto/combo.dto';
import GroupEventDto from 'src/events/dto/group-event.dto';

export class GroupDetailDto {
  id: number;
  privacy: GroupPrivacy;
  name: string;
  details: string;
  categoryId: string;
  category: ComboDto;
  parentId?: number;
  parent?: ComboDto;
  metaData?: string;
  address?: any;
  leaders?: number[];
  children?: ComboDto[]; 
  totalAttendance?: number;
  averageAttendance?: string;
  childEvents?: GroupEventDto[];
}
