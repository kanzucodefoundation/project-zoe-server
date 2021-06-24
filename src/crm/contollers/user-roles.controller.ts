import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UserRolesService } from '../user-roles.service';
import {UserRoleDto, UserRoleSearch} from '../dto/user-role.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('User Roles')
@Controller('api/user-roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Post()
  create(@Body() userRole: UserRoleDto): Promise<UserRoleDto> {
    return this.userRolesService.create(userRole);
  }

  @Get()
  findAll(@Query() data: UserRoleSearch): Promise<UserRoleDto[]> {
    return this.userRolesService.findAll(data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userRolesService.findOne(+id);
  }

  @Put()
  update(@Body() userRole: UserRoleDto): Promise<UserRoleDto> {
    return this.userRolesService.update(userRole);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
    return this.userRolesService.remove(id);
  }
}
