import { IsNotEmpty } from "class-validator";

export class UssdRequestDto {
  @IsNotEmpty()
  sessionId: string;
  @IsNotEmpty()
  serviceCode: string;
  @IsNotEmpty()
  networkCode: string;
  @IsNotEmpty()
  phoneNumber: string;
  text: string;
}
