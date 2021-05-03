import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from '../config';
import { usersEntities } from '../users/users.helpers';
import { crmEntities } from './crm.helpers';
import { groupEntities } from '../groups/groups.helpers';
import { CreatePersonDto } from './dto/create-person.dto';
import { Gender } from './enums/gender';
import { CivilStatus } from './enums/civilStatus';
import { Repository } from 'typeorm';
import Person from './entities/person.entity';

describe('ContactService', () => {
  let service: ContactsService;
  let personRepository: Repository<Person>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // TypeOrmModule.forRoot({
        //   type: 'mysql', ...config.database,
        //   entities: [
        //     ...usersEntities, ...crmEntities, ...groupEntities,
        //   ],
        //   logging:'all'
        // }),

        TypeOrmModule.forFeature([...crmEntities])
      ],
      providers: [
        ContactsService,
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    personRepository =  module.get('PersonRepository');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a person', async () => {
    const p: CreatePersonDto = {
      firstName: 'Eva',
      lastName: 'Mujungu',
      middleName: null,
      gender: Gender.Female,
      civilStatus: CivilStatus.Married,
      dateOfBirth: new Date('1900-12-20'),
      phone: '0701035517',
      email: 'eva@iotec.io'
    };
    const created = await personRepository.save(p);
    expect(created.id).toBeDefined();
  });
});
