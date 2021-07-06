import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts.service';
import { InjectRepository } from '@nestjs/typeorm';
import Person from '../entities/person.entity';
import { Repository } from 'typeorm';
import { CreatePersonDto } from '../dto/create-person.dto';
import { User } from '../../users/entities/user.entity';
import ContactListDto from '../dto/contact-list.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { UsersService } from 'src/users/users.service';

@UseInterceptors(SentryInterceptor)
@ApiTags('Register')
@Controller('api/register')
export class RegisterController {
  constructor(
    private readonly service: ContactsService,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UsersService,
  ) {}
  @Post()
  async create(@Body() data: CreatePersonDto): Promise<ContactListDto | Error> {
    const _contact = await this.service.createPerson(data);
    const contact = await ContactsService.toListDto(_contact);

    await this.userService.createUser({
      contactId: contact.id,
      username: contact.email,
      password: "12345678",
      roles: ["DASHBOARD", "USER_VIEW"],
      isActive: true,
    });

    console.log(contact)
    return contact;
  }
}
