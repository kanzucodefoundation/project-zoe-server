import {CivilStatus} from '../../crm/enums/civilStatus';
import {Gender} from '../../crm/enums/gender';
import { MinistryCategories } from '../../services/enums/ministryCategories';
import {IsDate, IsEmail, IsEnum, IsNotEmpty} from 'class-validator';

export class RegisterUserDto {

  category: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone:  string;

  @IsNotEmpty()
  password: string;

  roles: string[];

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  middleName?: string;

  @IsEnum(Gender)
  gender:  Gender;

  @IsEnum(CivilStatus)
  civilStatus:  CivilStatus;

  @IsDate()
  dateOfBirth: Date;

  ministry: MinistryCategories;

  profession: string;

}
