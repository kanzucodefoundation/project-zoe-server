import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class MemberEventActivitiesDto {


    @Type(() => Number)
    @IsNumber()
    id: number;
    
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    activityId: number;
    
    @IsNotEmpty()
     @Type(() => Number)
     @IsNumber()
    @Min(0)
    contactId:number[];

}
