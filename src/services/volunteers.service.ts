import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import Person from '../crm/entities/person.entity';
import Contact from '../crm/entities/contact.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {
  }

  async findAll(): Promise<Person[]> {
    const getCategory = await this.contactRepository
    .find({
      select: ['id'],
      where: [
        {
          category: Like("Volunteer"),
        },
      ],
    });

    const resp = await this.personRepository
      .find({
        select: ['firstName', 'lastName', 'profession'],
        where: [
          {
            contactId: Like(getCategory),
          },
        ],
      });
    return resp;
  }
}