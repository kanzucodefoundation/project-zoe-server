import { ApiProperty } from '@nestjs/swagger';
import { UserPermissions } from 'src/users/dto/user-list.dto';

export class UserDto extends UserPermissions {
  @ApiProperty()
  id: number;
  @ApiProperty()
  contactId: number;
  @ApiProperty()
  username: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  fullName: string;
  @ApiProperty()
  roles: string[];
  @ApiProperty()
  isActive: boolean;
}
