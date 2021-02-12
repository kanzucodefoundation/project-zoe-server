import { GroupPrivacy } from '../enums/groupPrivacy';
import ComboDto from '../../shared/dto/combo.dto';

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
  freeForm?: string;
  latitude?: number;
  longitude?: number;
  geoCoordinates?: string;
  placeId?: string;
  leaders?: number[];
}
