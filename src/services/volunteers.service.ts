import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import Person from '../crm/entities/person.entity';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import Group from 'src/groups/entities/group.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    // @InjectRepository(Group)
    // private readonly groupRepository: Repository<Group>,
    // @InjectRepository(GroupMembership)
    // private readonly membershipRepository: Repository<GroupMembership>,
  ) {
  }

  async findAll(): Promise<Person[]> {
    // const ministryNames = await this.groupRepository
    // .find({
    //   select: ['name'],
    //   where: [
    //     {
    //       categoryId: Like("M"),
    //     },
    //   ],
    // });

    // const groupCategory = await this.membershipRepository
    // .find({
    //   select: ['id'],
    //   where: [
    //     {
    //       category: Like("Volunteer"),
    //     },
    //   ],
    // });

    const resp = await this.personRepository
      .find({
        select: ['contactId', 'firstName', 'lastName'],
        // where: [
        //   {
        //     contactId: Like(getCategory),
        //   },
        // ],
      });
    return resp;
  }
}