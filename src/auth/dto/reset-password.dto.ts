import {IsEmail, IsNotEmpty} from 'class-validator';

export class ValidatePasswordDto {
  @IsNotEmpty()
  password: string;
}

export class ValidateEmailDto {
  @IsNotEmpty()
  @IsEmail()
  username: string;
}




