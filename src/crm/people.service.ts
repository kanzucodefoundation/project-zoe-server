import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { hasValue } from 'src/utils/validation';
import { FindConditions, Like, Repository } from 'typeorm';
import { ContactsService } from './contacts.service';
import { getPersonFullName } from './crm.helpers';
import ContactListDto from './dto/contact-list.dto';
import { ContactSearchDto } from './dto/contact-search.dto';
import { CreatePersonDto } from './dto/create-person.dto';
import { PersonEditDto } from './dto/person-edit.dto';
import PersonListDto from './dto/person-list.dto';
import Person from './entities/person.entity';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly service: ContactsService,
  ) {}

  async findAll(req: ContactSearchDto): Promise<Person[]> {
    let q: FindConditions<Person>[] = [];
    if (hasValue(req.query)) {
      q = [
        {
          firstName: Like(`${req.query}%`),
        },
        {
          middleName: Like(`${req.query}%`),
        },
        {
          lastName: Like(`${req.query}%`),
        },
      ];
    }
    return await this.personRepository.find({
      where: q,
      skip: req.skip,
      take: req.limit,
    });
  }

  async findCombo(req: ContactSearchDto): Promise<PersonListDto[]> {
    let q: FindConditions<Person>[] = [];
    if (hasValue(req.query)) {
      q = [
        {
          firstName: Like(`${req.query}%`),
        },
        {
          middleName: Like(`${req.query}%`),
        },
        {
          lastName: Like(`${req.query}%`),
        },
      ];
    }
    let data = await this.personRepository.find({
      select: [
        'id',
        'firstName',
        'lastName',
        'middleName',
        'avatar',
        'contactId',
      ],
      where: q,
      skip: req.skip,
      take: req.limit,
    });

    if (req.skipUsers) {
      const users = await this.userRepository.find({
        where: {},
        select: ['contactId'],
      });
      const idList = users.map((it) => it.contactId);
      data = data.filter((it) => idList.indexOf(it.contactId) < 0);
    }
    return data.map((it) => ({
      id: it.contactId,
      name: getPersonFullName(it),
      avatar: it.avatar,
    }));
  }

  async create(data: CreatePersonDto): Promise<ContactListDto> {
    const created = await this.service.createPerson(data);
    const contact = await this.service.findOne(created.id);
    return ContactsService.toListDto(contact);
  }

  async update({ id, ...data }: PersonEditDto): Promise<Person> {
    await this.personRepository
      .createQueryBuilder()
      .update()
      .set({
        ...data,
      })
      .where('id = :id', { id })
      .execute();

    return await this.personRepository.findOne({ where: { id } });
  }
}
