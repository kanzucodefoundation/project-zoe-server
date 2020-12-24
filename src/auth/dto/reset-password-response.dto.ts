import { ApiProperty } from '@nestjs/swagger';
import { UserListDto } from '../../users/dto/user-list.dto';

export class ResetPasswordResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  mailURL: string;

  @ApiProperty()
  user: UserListDto;
}





