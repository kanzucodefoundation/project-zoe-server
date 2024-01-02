import { IsNotEmpty } from "class-validator";

export class UssdRequestDto {
  @IsNotEmpty()
  sessionId: string;
  @IsNotEmpty()
  serviceCode: string;
  @IsNotEmpty()
  phoneNumber: string;
  @IsNotEmpty()
  text: string;
}
