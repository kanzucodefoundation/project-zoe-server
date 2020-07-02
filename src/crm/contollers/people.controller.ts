import { Body, Controller, Get, Post, Put, Query, UploadedFile, UseInterceptors, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts.service';
import { InjectRepository } from '@nestjs/typeorm';
import Person from '../entities/person.entity';
import { Like, Repository, getRepository } from 'typeorm';
import { ContactSearchDto } from '../dto/contact-search.dto';
import { CreatePersonDto } from '../dto/create-person.dto';
import { getPersonFullName } from '../crm.helpers';
import { hasValue } from '../../utils/basicHelpers';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { FileInterceptor } from '@nestjs/platform-express';
import PersonListDto from '../dto/person-list.dto';
import Contact from '../entities/contact.entity';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import Group from 'src/groups/entities/group.entity';


@ApiTags('Crm People')
@Controller('api/crm/people')
export class PeopleController {
  constructor(
    private readonly service: ContactsService,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {
  }

  @Get()
  async findAll(@Query() req: ContactSearchDto): Promise<Person[]> {
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

  @Get('combo')
  async findCombo(@Query() req: ContactSearchDto): Promise<PersonListDto[]> {
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
    const data = await this.personRepository.find({
      select: ['id', 'firstName', 'lastName', 'middleName', 'avatar'],
      where: q,
      skip: req.skip,
      take: req.limit,
    });
    return data.map(it => ({
      id: it.id,
      name: getPersonFullName(it),
      avatar: it.avatar,
    }));
  }

  // Added by Daniel
  @Get('volunteers')
  async findTheVolunteers() {
    const volunteers = await getRepository(Person)
      .createQueryBuilder("person")
      // .leftJoinAndSelect("person.ministries", "ministry")
      .innerJoinAndMapOne("person.groupMembership", GroupMembership, "groupMembership", "person.contactId = groupMembership.contactId")
      .innerJoinAndMapMany("person.group", Group, "group", "groupMembership.groupId = group.id")
      .where("groupMembership.role = :role", { role: "Volunteer" })
      .getMany();

      return volunteers;
  }
  
  @Get('volunteers/:id')
  async findTheVolunteer(@Param('id') id: number) {
    const volunteer = await getRepository(Person)
      .createQueryBuilder("person")
      .innerJoinAndMapOne("person.groupMembership", GroupMembership, "groupMembership", "person.contactId = groupMembership.contactId")
      .innerJoinAndMapMany("person.group", Group, "group", "groupMembership.groupId = group.id")
      .where("groupMembership.contactId = :contactId", { contactId: id })
      .andWhere("groupMembership.role = :role", { role: "Volunteer" })
      .getMany();

      return volunteer;
  }
  
  @Get('personsAndTheirGroups')
  async findPersonsAndTheirGroups() {
    const personsAndTheirGroups = await getRepository(Person)
      .createQueryBuilder("person")
      .innerJoinAndMapOne("person.groupMembership", GroupMembership, "groupMembership", "person.contactId = groupMembership.contactId")
      .innerJoinAndMapMany("person.group", Group, "group", "groupMembership.groupId = group.id")
      .getMany();

      return personsAndTheirGroups;
  }
  
  @Get(':id')
  async findOne(@Param('id') id: number) {
    const resp = await this.personRepository
      .find({
        select: ['contactId', 'firstName', 'lastName'],
        where: [
          {
            id: Like(id),
          },
        ],
      });
    return resp;
  }
  // END

  @Post()
  async create(@Body()data: CreatePersonDto): Promise<Contact> {
    return await this.service.createPerson(data);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file) {
    console.log(file);
  }

  @Put()
  async update(@Body()data: Person): Promise<Person> {
    return await this.personRepository.save(data);
  }
}

