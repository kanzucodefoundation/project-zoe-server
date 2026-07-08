import { ApiProperty } from '@nestjs/swagger';
import { UserPermissions } from 'src/users/dto/user.dto';

export class UserDto extends UserPermissions {
  @ApiProperty()
  id: number;
  @ApiProperty()
  contactId: number;
  @ApiProperty()
  username: string;
  @ApiProperty({ required: false, nullable: true })
  email: string | null;
  @ApiProperty()
  fullName: string;
  @ApiProperty()
  roles: string[];
  @ApiProperty()
  isActive: boolean;
  @ApiProperty({ required: false, nullable: true })
  lastLogin?: Date | null;
  @ApiProperty()
  permissions?: string[];
}
