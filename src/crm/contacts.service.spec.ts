import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Person from './entities/person.entity';
import config, { appEntities } from '../config';
import { VendorModule } from 'src/vendor/vendor.module';
import { PrismaService } from 'src/shared/prisma.service';
import { CrmModule } from './crm.module';
import { UsersModule } from 'src/users/users.module';

describe('ContactService', () => {
  let service: ContactsService;
  let personRepository: Repository<Person>;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...config.database,
          entities: [...appEntities],
          //logging: 'all',
          keepConnectionAlive: true,
        }),
        TypeOrmModule.forFeature([...appEntities]),
        CrmModule,
        VendorModule,
        UsersModule,
      ],
      providers: [ContactsService, PrismaService],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    personRepository = module.get('PersonRepository');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /*it('should create a person', async () => {
    const p: CreatePersonDto = {
      firstName: 'Eva',
      lastName: 'Mujungu',
      middleName: null,
      gender: Gender.Female,
      civilStatus: CivilStatus.Married,
      dateOfBirth: new Date('1900-12-20'),
      phone: '0701035517',
      email: 'eva@iotec.io',
    };
    const created = await personRepository.save(p);
    expect(created.id).toBeDefined();
  });*/
});
