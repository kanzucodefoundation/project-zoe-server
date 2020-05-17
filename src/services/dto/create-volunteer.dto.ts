import { MinistryCategories } from '../enums/ministryCategories';
import { IsDateString, IsEnum, IsNotEmpty } from 'class-validator';


export class CreateVolunteerDto {
  // query?: string;
  // limit: number = 100;
  // skip: number = 0;


  @IsEnum(MinistryCategories)
  ministry: MinistryCategories;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  surname: string;

  @IsDateString()
  dateOfBirth: Date;

  @IsNotEmpty()
  missionalCommunity: string;
  
  @IsNotEmpty()
  profession: string;

}
