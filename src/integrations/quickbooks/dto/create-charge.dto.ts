import { IsNumber, IsString, Min } from 'class-validator';

export class CreateChargeDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  cardNumber: string;

  @IsString()
  expMonth: string;

  @IsString()
  expYear: string;

  @IsString()
  cvc: string;

  @IsString()
  cardholderName: string;

  @IsString()
  description: string;
}
