import { CivilStatus } from '../enums/civilStatus';
import { Gender } from '../enums/gender';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { GroupRole } from '../../groups/enums/groupRole';

export class CreatePersonDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  phone?: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  middleName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(CivilStatus)
  civilStatus?: CivilStatus;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date | string;
  ageGroup?: string;

  placeOfWork?: string;
  residence?: any;

  cellGroupId?: any;
  churchLocationId?: number;

  inCell?: any;

  joinCell?: any;

  // Optional fields for user registration (required in RegisterDto)
  password?: string;

  @IsOptional()
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsEnum(GroupRole)
  groupRole?: GroupRole;
}
