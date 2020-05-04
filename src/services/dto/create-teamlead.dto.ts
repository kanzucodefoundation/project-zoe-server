import { IsDateString, IsEnum, IsNotEmpty } from 'class-validator';


export class CreateTeamleadDto {
  

  @IsNotEmpty()
  taskname: string;

 

  @IsDateString()
  startdate: Date;

  @IsDateString()
  enddate: Date;

  @IsNotEmpty()
  taskinfo: string;
  
  @IsNotEmpty()
  volunteers: string;

}
