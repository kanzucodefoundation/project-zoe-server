import { IsNumber, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateChargeDto {
  /**
   * Idempotency key for this charge. Intuit treats a repeat of the same value
   * as the same operation, so a caller retrying after a timeout must send the
   * value it sent the first time — a fresh one charges the card again.
   */
  @IsString()
  @Matches(/\S/, { message: 'requestId must not be blank' })
  @MaxLength(50)
  requestId: string;

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
