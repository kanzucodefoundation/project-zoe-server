import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usersEntities } from './users.helpers';
import { crmEntities } from '../crm/crm.helpers';
import { groupEntities } from '../groups/groups.helpers';
import { User } from './entities/user.entity';
import { ContactsService } from '../crm/contacts.service';
import { CrmModule } from '../crm/crm.module';
import { UsersModule } from './users.module';
import config, { appEntities } from 'src/config';

describe('UsersService', () => {
  let service: UsersService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [UsersModule],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('Create New user', async () => {
    const user = new User();
    user.id = 1;
    user.username = 'test';
    user.password = 'testPassword';
    user.contactId = 1;
    user.isActive = true;
    const created = await service.create(user);
    console.log('Created', created);
    expect(created.id).toBeDefined();
  });
});
