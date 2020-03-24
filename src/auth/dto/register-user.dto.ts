import { ApiProperty } from '@nestjs/swagger';
import { CivilStatus } from '../../crm/enums/civilStatus';
import { Gender } from '../../crm/enums/gender';
import { IsEmail, IsNotEmpty, IsEnum,IsDate } from 'class-validator';

export class RegisterUserDto {

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @ApiProperty()
  phone:  string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;


  @ApiProperty()
  roles: string[];

  @IsNotEmpty()
  @ApiProperty()
  firstName: string;

  @IsNotEmpty()
  @ApiProperty()
  lastName: string;


  @ApiProperty()
  middleName?: string;

  @IsEnum(Gender)
  @ApiProperty()
  gender:  Gender;

  @IsEnum(CivilStatus)
  @ApiProperty()
  civilStatus:  CivilStatus;


  @IsDate()
  @ApiProperty()
  dateOfBirth: Date;

}
