import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmModule } from '../crm/crm.module';
import config, { appEntities } from 'src/config';
import { AuthModule } from 'src/auth/auth.module';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...config.database,
          entities: [...appEntities],
          //logging: 'all,
          keepConnectionAlive: true,
        }),
        TypeOrmModule.forFeature([...appEntities]),
        CrmModule,
        AuthModule,
      ],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /*it('Create New user', async () => {
    const user = new User();
    user.id = 1;
    user.username = 'test';
    user.password = 'testPassword';
    user.contactId = 1;
    user.isActive = true;
    const created = await service.create(user);
    console.log('Created', created);
    expect(created.id).toBeDefined();
  });*/
});
