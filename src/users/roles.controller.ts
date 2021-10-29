import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesDto } from './dto/roles.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import SearchDto from 'src/shared/dto/search.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('User Roles')
@Controller('api/user-roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() userRole: RolesDto): Promise<RolesDto> {
    return this.rolesService.create(userRole);
  }

  @Get()
  findAll(@Query() data: SearchDto): Promise<RolesDto[]> {
    return this.rolesService.findAll(data);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.rolesService.findOne(id);
  }

  @Put()
  update(@Body() userRole: RolesDto): Promise<RolesDto> {
    return this.rolesService.update(userRole);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
    return this.rolesService.remove(id);
  }
}
