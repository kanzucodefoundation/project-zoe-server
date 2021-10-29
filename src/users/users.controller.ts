import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import SearchDto from '../shared/dto/search.dto';
import { ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto } from './dto/user-list.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserResponseDto } from './dto/create-user-response.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly service: UsersService) {
  }

  
  @Get()
  async findAll(@Query() req: SearchDto): Promise<UserListDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: CreateUserDto): Promise<UserListDto> {
    return await this.service.createUser(data);
  }

  @Put()
  async update(@Body() data: UpdateUserDto): Promise<UserListDto> {
    return await this.service.update(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<UserListDto> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}





