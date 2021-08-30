import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";
import SearchDto from "src/shared/dto/search.dto";


export default class EventActivitiesSearchDto extends SearchDto{
@Type(()=>Number)
@IsNumber()
// @Min(0)
eventId?:number;    
}