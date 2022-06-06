import {
  Body,
  Controller,
  Post,
  Inject,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ContactsService } from "../contacts.service";
import Person from "../entities/person.entity";
import { Repository, Connection } from "typeorm";
import { CreatePersonDto } from "../dto/create-person.dto";
import { User } from "../../users/entities/user.entity";
import ContactListDto from "../dto/contact-list.dto";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { UsersService } from "src/users/users.service";

@UseInterceptors(SentryInterceptor)
@ApiTags("Register")
@Controller("api/register")
export class RegisterController {
  private readonly personRepository: Repository<Person>;
  private readonly userRepository: Repository<User>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private readonly service: ContactsService,
    private readonly userService: UsersService,
  ) {
    this.personRepository = connection.getRepository(Person);
    this.userRepository = connection.getRepository(User);
  }
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

    return contact;
  }
}
