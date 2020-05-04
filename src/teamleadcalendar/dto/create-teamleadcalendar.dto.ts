import { IsDateString, IsEnum, IsNotEmpty } from 'class-validator';


export class CreateTeamleadcalendarDto {
  

  @IsNotEmpty()
  startDate: Date | string | number;

  @IsNotEmpty()
  endDate?: Date | string | number;

  @IsNotEmpty()
  title?: string;


  @IsNotEmpty()
  allDay?: boolean;
 
  @IsNotEmpty()
  id?: number | string;


  @IsNotEmpty()
  rRule?: string;


  @IsNotEmpty()
  exDate?: string;

  // @IsNotEmpty()
  // [propertyName: string]: any;

}
