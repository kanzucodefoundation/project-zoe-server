import { UserListDto } from './user.dto';

export class CreateUserResponseDto {
  token: string;
  mailURL: string;
  user: UserListDto;
}
