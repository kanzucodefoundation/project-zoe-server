import { Test, TestingModule } from '@nestjs/testing';
import { GroupFinderService } from './group-finder.service';

describe('GroupFinderService', () => {
  let service: GroupFinderService;

  beforeEach(async () => {
    const mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
      getTreeRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        findRoots: jest.fn(),
        findDescendants: jest.fn(),
        findAncestors: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        createDescendantsQueryBuilder: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupFinderService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
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
    expect(data.length).toEqual(0);
  });
});
