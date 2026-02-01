import { IsNotEmpty, IsNumber, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

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
