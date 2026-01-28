import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SendSmsDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  message: string;
}
