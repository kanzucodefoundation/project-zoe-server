import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class CreateMemberEventActivitiesDto {

   
  
    id: number;
    
   
    activityId: number;
    
   
    contactId:number[];

}
