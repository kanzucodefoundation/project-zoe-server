import { IsEnum, IsNotEmpty } from "class-validator";
import { Gender } from "src/crm/enums/gender";
import { WHLocation } from "../enums/whLocation";

//DTO to return the visitor information
export class VisitorDto {
    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;

    @IsEnum(Gender)
    gender: Gender;

    @IsNotEmpty()
    phone: string;

    @IsNotEmpty()
    residence: string;

    @IsEnum(WHLocation)
    whLocation: WHLocation;
 
}