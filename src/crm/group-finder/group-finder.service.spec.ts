import { Test, TestingModule } from '@nestjs/testing';
import { GroupFinderService } from './group-finder.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from '../../config';
import { appEntities } from '../../config';

describe('GroupFinderService', () => {
  let service: GroupFinderService;

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
      providers: [GroupFinderService],
    }).compile();

    service = module.get<GroupFinderService>(GroupFinderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('can find child groups', async () => {
    const data = await service.findClosestGroup({
      parentGroupId: 1,
      placeId: '',
    });
    console.log(data);
    expect(data.length).toEqual(2);
  });
});
