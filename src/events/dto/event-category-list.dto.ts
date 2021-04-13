import { EventCategoryDto } from "./event-category.dto";

//Client requests all categories
export class EventCategoryListDto {
    categories: EventCategoryDto[];
}
