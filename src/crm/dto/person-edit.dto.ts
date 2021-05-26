import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Gender } from '../enums/gender';
import { CivilStatus } from '../enums/civilStatus';
import { Salutation } from '../enums/salutation';

export class PersonEditDto {
  @IsNumber()
  id: number;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  middleName?: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsEnum(CivilStatus)
  civilStatus?: CivilStatus;

  @IsDateString()
  dateOfBirth: Date;

  residence?: string;

  placeOfWork?: string;

  @IsNumber()
  contactId: number;

  @IsOptional()
  @IsEnum(Salutation)
  salutation?: Salutation;

  age?: string;

  avatar?: string;
}
