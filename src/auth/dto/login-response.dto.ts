import { ApiProperty } from '@nestjs/swagger';
import { UserListDto } from 'src/users/dto/user.dto';
import { UserDto } from './user.dto';

export class GroupHierarchyDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  memberCount: number;
}

export class ManageableGroupDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
}

export class HierarchyDto {
  @ApiProperty({ type: [GroupHierarchyDto] })
  myGroups: GroupHierarchyDto[];
  @ApiProperty({ type: [ManageableGroupDto] })
  canManageGroups: ManageableGroupDto[];
  @ApiProperty({ type: [ManageableGroupDto] })
  canViewGroups: ManageableGroupDto[];
}

export class LoginResponseDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  user: UserDto | UserListDto;
  @ApiProperty()
  hierarchy?: HierarchyDto;
}

export class RefreshTokenResponseDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  refreshToken: string;
}
