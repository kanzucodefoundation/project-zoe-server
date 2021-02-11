import { CivilStatus } from '../enums/civilStatus';
import { Gender } from '../enums/gender';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty } from 'class-validator';


export class CreatePersonDto {

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  middleName?: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsEnum(CivilStatus)
  civilStatus: CivilStatus;

  @IsDateString()
  dateOfBirth: Date;
  ageGroup?: string;

  placeOfWork?: string;
  residence?: any;

  cellGroupId?: any;
  churchLocationId?: number;

  inCell?: any;

  joinCell?: any;
}


