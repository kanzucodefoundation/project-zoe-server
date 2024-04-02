import { ApiProperty } from '@nestjs/swagger';
import { UserListDto } from 'src/users/dto/user.dto';
import { UserDto } from './user.dto';

export class LoginResponseDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  user: UserDto | UserListDto;
}
