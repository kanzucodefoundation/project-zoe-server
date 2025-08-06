import { ApiProperty } from "@nestjs/swagger";
import { UserListDto } from "src/users/dto/user.dto";

export class ForgotPasswordResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  mailURL: string;

  @ApiProperty()
  message?: string;

  @ApiProperty()
  user?: UserListDto;
}
