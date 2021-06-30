import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  roles: string[];
  oldPassword?: string;
  password?: string;
  isActive?: boolean;
}
