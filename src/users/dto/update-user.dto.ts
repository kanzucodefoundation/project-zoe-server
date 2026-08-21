import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEmail,
} from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  roles?: string[];

  @IsOptional()
  oldPassword?: string;

  @IsOptional()
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
