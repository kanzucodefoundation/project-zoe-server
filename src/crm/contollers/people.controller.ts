import { Body, Controller, Get, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts.service';
import { InjectRepository } from '@nestjs/typeorm';
import Person from '../entities/person.entity';
import { Like, Repository } from 'typeorm';
import { ContactSearchDto } from '../dto/contact-search.dto';
import { CreatePersonDto } from '../dto/create-person.dto';
import { getPersonFullName } from '../crm.helpers';
import { hasValue } from '../../utils/basicHelpers';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { FileInterceptor } from '@nestjs/platform-express';
import PersonListDto from '../dto/person-list.dto';
import Contact from '../entities/contact.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/user.entity';
import ContactListDto from '../dto/contact-list.dto';


@ApiTags('Crm People')
@Controller('api/crm/people')
export class PeopleController {
  constructor(
    private readonly service: ContactsService,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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
    let data = await this.personRepository.find({
      select: ['id', 'firstName', 'lastName', 'middleName', 'avatar', 'contactId'],
      where: q,
      skip: req.skip,
      take: req.limit,
    });

    if (req.skipUsers) {
      const users = await this.userRepository.find({
        where: {},
        select: ['contactId'],
      });
      const idList = users.map(it => it.contactId);
      data = data.filter(it => idList.indexOf(it.contactId) < 0);
    }
    return data.map(it => ({
      id: it.contactId,
      name: getPersonFullName(it),
      avatar: it.avatar,
    }));
  }


  @Post()
  async create(@Body()data: CreatePersonDto): Promise<ContactListDto> {
    const contact =  await this.service.createPerson(data);
    return ContactsService.toListDto(contact);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file) {
    console.log(file);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async update(@Body()data: Person): Promise<Person> {
    return await this.personRepository.save(data);
  }
}
