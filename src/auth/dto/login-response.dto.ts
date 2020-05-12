import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class LoginResponseDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  user: UserDto;
}
