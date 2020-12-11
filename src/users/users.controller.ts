import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import SearchDto from '../shared/dto/search.dto';
import { User } from './user.entity';
import { ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto } from './dto/user-list.dto';
import { UserProfileDto } from "./dto/user-profile.dto";
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import Email from '../crm/entities/email.entity';
import { Repository } from 'typeorm';

@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(@InjectRepository(Email)
              private readonly emailRepository: Repository<Email>,
              private readonly service: UsersService) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<UserListDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body()data: CreateUserDto): Promise<User> {
    const email = await this.emailRepository.findOne({ where: { contactId: data.contactId } });
    const toSave = new User();
    toSave.username = email.value;
    toSave.contactId = data.contactId ;
    toSave.password = data.password;
    toSave.roles = data.roles;
    toSave.hashPassword();
    return await this.service.create(toSave);
  }

  @Put()
  async update(@Body()data: UpdateUserDto): Promise<UserListDto> {
    return await this.service.update(data);
  }

  @Get('viewProfile/:id')
  async viewProfile(@Param('id') id: number): Promise<UserProfileDto> {
    return await this.service.getProfile(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}




