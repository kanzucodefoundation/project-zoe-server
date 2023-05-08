import { EventPrivacy } from "../enums/EventPrivacy";
import InternalAddressDto from "../../shared/dto/internal-address-dto";

export default class CreateEventDto {
  privacy: EventPrivacy;

  name: string;

  summary: string;

  startDate?: Date;

  endDate?: Date;

  details: string;

  venue?: InternalAddressDto;

  categoryId: number;
  groupId?: number;

  metaData?: any;
}
