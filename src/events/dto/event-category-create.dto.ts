import { IsNotEmpty } from "class-validator";
import EventFieldDto from "./event-field.dto";

//Client wants to create a new category
export class EventCategoryCreateDto {
     @IsNotEmpty()
    name:string;

    //fields?: EventFieldDto;
}
