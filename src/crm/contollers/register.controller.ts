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
  ) {}
  @Post()
  async create(@Body() data: CreatePersonDto): Promise<ContactListDto | Error> {
    const contact = await this.service.createPerson(data);
      return ContactsService.toListDto(contact);
  }
}
