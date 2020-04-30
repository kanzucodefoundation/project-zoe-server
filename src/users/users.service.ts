import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterUserDto } from '../auth/dto/register-user.dto';
import SearchDto from '../shared/dto/search.dto';
import { ContactsService } from '../crm/contacts.service';
import Contact from '../crm/entities/contact.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    private readonly contactsService: ContactsService,
  ) {}

  async findAll(req: SearchDto): Promise<User[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async create(data: User): Promise<User> {
    data.hashPassword();
    return await this.repository.save(data);
  }

  async register(dto: RegisterUserDto): Promise<User> {
    const contact = await this.contactsService.createPerson(dto);
    console.log('created contact', contact);
    const user = new User();
    user.username = dto.email;
    user.password = dto.password;
    user.contact = Contact.ref(contact.id);
    user.hashPassword();
    return await this.repository.save(user);
  }

  findOne(id: number): Promise<User> {
    return this.repository.findOne(id);
  }

  async update(data: User): Promise<User> {
    data.hashPassword();
    return await this.repository.save(data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByName(username: string): Promise<User | undefined> {
    return this.repository.findOne({ where: { username }, relations: ['contact', 'contact.person'] });
  }

  async exits(username: string): Promise<boolean> {
    const count = await this.repository.count({ where: { username } });
    return count > 0;
  }
}
