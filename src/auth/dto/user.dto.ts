import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
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
