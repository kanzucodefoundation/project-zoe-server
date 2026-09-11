import { IsString } from 'class-validator';

export class ExchangeTokenDto {
  @IsString()
  code: string;

  @IsString()
  realmId: string;

  @IsString()
  state: string;
}
