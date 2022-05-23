import { ApiProperty } from "@nestjs/swagger";

export default class LoginDto {
  @ApiProperty()
  username: string;
  @ApiProperty()
  password: string;
  @ApiProperty()
  churchName: string;
}
