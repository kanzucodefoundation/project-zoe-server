import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePersonDto } from '../dto/create-person.dto';
import ContactListDto from '../dto/contact-list.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { UsersService } from 'src/users/users.service';

@UseInterceptors(SentryInterceptor)
@ApiTags('Register')
@Controller('api/register')
export class RegisterController {
  constructor(private readonly userService: UsersService) {}
  @Post()
  async create(@Body() data: CreatePersonDto): Promise<ContactListDto | Error> {
    return await this.userService.registerUser(data);
  }
}
