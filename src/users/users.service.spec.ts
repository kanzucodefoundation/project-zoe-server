import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usersEntities } from './users.helpers';
import { crmEntities } from '../crm/crm.helpers';
import { groupEntities } from '../groups/groups.helpers';
import { User } from './user.entity';
import { ContactsService } from '../crm/contacts.service';
import { CrmModule } from '../crm/crm.module';
import { UsersModule } from './users.module';

describe('UsersService', () => {
  let service: UsersService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [

        CrmModule,UsersModule,
        TypeOrmModule.forFeature([...usersEntities,...crmEntities,...groupEntities])
      ],
      providers: [UsersService,ContactsService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Create New user', async () => {
    const user = new User();
    user.username='test';
    user.password='test';
    const created = await service.create(user);
    console.log("Created",created)
    expect(created.id).toBeDefined();
  });
});
