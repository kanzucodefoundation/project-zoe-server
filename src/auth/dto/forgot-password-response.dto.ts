import { ApiProperty } from '@nestjs/swagger';
import { UserListDto } from 'src/users/dto/user-list.dto';

export class ForgotPasswordResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  mailURL: string;

  @ApiProperty()
  user: UserListDto;
}




