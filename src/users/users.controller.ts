import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import SearchDto from '../shared/dto/search.dto';
import { User } from './user.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags("Users")
@Controller('api/users')
export class UsersController {
  constructor(private readonly service: UsersService) {
  }

  @Get()
  async findAll(@Query() req: SearchDto): Promise<User[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(data: User): Promise<User> {
    return await this.service.create(data);
  }

  @Put()
  async update(data: User): Promise<User> {
    return await this.service.update(data);
  }

  @Get(":id")
  async findOne(@Param('id') id:number): Promise<User> {
    return await this.service.findOne(id);
  }

  @Delete(":id")
  async remove(@Param('id') id:number): Promise<void> {
    await this.service.remove(id);
  }
}

