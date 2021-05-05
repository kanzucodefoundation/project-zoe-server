import { CivilStatus } from '../../crm/enums/civilStatus';
import { Gender } from '../../crm/enums/gender';
import {
  IsDate,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  password: string;

  roles: string[];

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
  dateOfBirth: string | Date;
}
