import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Person from '../crm/entities/person.entity';
import Group from 'src/groups/entities/group.entity';

@Injectable()
export class VolunteeringService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {
  }

  async findAll(): Promise<Person[]> {
    const persons = await this.personRepository
      .find({
        select: ['contactId', 'firstName', 'lastName'],
      });
    return persons;
  }

  async findAllMinistries() {
    const ministries = await getRepository(Group)
    .createQueryBuilder("group")
    .where("group.categoryId = :categoryId", { categoryId: "M" })
    .getMany();

    return ministries;
  }
}