import { Test, TestingModule } from '@nestjs/testing';
import { GroupsMembershipService } from './group-membership.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import config, { appEntities } from '../../config';

describe('EventsService', () => {
  let service: GroupsMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...config.database,
          entities: [...appEntities],
          logging: 'all',
        }),
        TypeOrmModule.forFeature([...appEntities]),
      ],
      providers: [GroupsMembershipService],
    }).compile();

    service = module.get<GroupsMembershipService>(GroupsMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be able to find all', async () => {
    const data = await service.findAll({ groupId: 2 });

    expect(data.length).toBe(1);
  });
});
