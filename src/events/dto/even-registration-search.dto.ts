import SearchDto from 'src/shared/dto/search.dto';

export default class EventRegistrationSearchDto extends SearchDto {
  groupId?: number;
  contactId?: number;
  eventId?: number;
}
