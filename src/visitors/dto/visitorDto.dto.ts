import { IsAlpha, IsEnum, IsNotEmpty, IsPhoneNumber, IsString } from "class-validator";
import { Gender } from "src/crm/enums/gender";
import { WHLocation } from "../enums/whLocation";

//Validation of visitor's information
export class VisitorDto {
    @IsNotEmpty()
    @IsString()
    @IsAlpha()
    firstName: string;

    @IsNotEmpty()
    @IsString()
    @IsAlpha()
    lastName: string;
    
    @IsEnum(Gender)
    gender: Gender;

    @IsNotEmpty()
    //Accepts phone numbers in the formats [ +256772000000, 256772000000, 0772000000, 772000000]
    @IsPhoneNumber("UG")
    phone: string;

    @IsNotEmpty()
    residence: string;

    @IsEnum(WHLocation)
    whLocation: WHLocation;
 
}
