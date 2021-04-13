import { IsNotEmpty } from "class-validator";
import EventFieldDto from "./event-field.dto";

//Client requests or updates a category
export class EventCategoryDto {
    @IsNotEmpty()
    id: number;

    @IsNotEmpty()
    name:string;
    
    fields?: EventFieldDto[];
}
