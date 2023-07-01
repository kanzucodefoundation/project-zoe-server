import SearchDto from "../../shared/dto/search.dto";
import EventCategory from "../entities/eventCategory.entity";

export default class EventFieldSearchDto extends SearchDto {
  category?: EventCategory;
}
