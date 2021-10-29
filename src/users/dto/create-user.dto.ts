import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsNumber()
  contactId: number;

  username: string;
  @IsNotEmpty()
  password: string;
  @IsNotEmpty()
  roles: string[];
  @IsNotEmpty()
  isActive: boolean;
}
