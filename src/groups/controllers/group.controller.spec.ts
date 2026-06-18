import { Test, TestingModule } from '@nestjs/testing';
import { GroupPrivacy } from '../enums/groupPrivacy';
import { GroupsService } from '../services/groups.service';
import { GroupController } from './group.controller';
import { UsersService } from '../../users/users.service';

describe('GroupController', () => {
  let controller: GroupController;

  const mockGroupService = {
    findAll: jest.fn((req) => {
      return [
        {
          id: Date.now(),
          privacy: 'Public',
          name: 'Group A',
          details: 'Details of Group A',
          categoryId: Date.now(),
          category: {
            id: 'A Category',
            name: 'A Category',
          },
          parentId: Date.now(),
          parent: {
            id: Date.now(),
            name: 'Parent A',
          },
        },
      ];
    }),
    update: jest.fn((dto) => {
      return {
        id: dto.id,
        privacy: dto.id,
        name: dto.name,
        details: dto.details,
        categoryId: dto.categoryId,
        category: {
          id: dto.categoryId,
          name: 'Random Category',
        },
        parentId: dto.parentId,
        parent: {
          id: dto.parentId,
          name: 'Immediate Parent',
        },
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [
        GroupsService,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    })
      .overrideProvider(GroupsService)
      .useValue(mockGroupService)
      .compile();

    controller = module.get<GroupController>(GroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should display a list of public groups', async () => {
    const expectedObj = {
      id: expect.any(Number),
      privacy: expect.any(String),
      name: expect.any(String),
      details: expect.any(String),
      categoryId: expect.any(Number),
      category: {
        id: expect.any(String),
        name: expect.any(String),
      },
      parentId: expect.any(Number),
      parent: {
        id: expect.any(Number),
        name: expect.any(String),
      },
    };
    const req = {};
    const rawRequest = { user: { id: 1 }, headers: {} };
    const result = await controller.findAll(req, rawRequest);
    result.forEach((it) => {
      expect(it).toMatchObject(expectedObj);
    });
  });

  it('should update a team/group', async () => {
    const dto = {
      id: Date.now(),
      privacy: GroupPrivacy.Public,
      name: 'Group A',
      details: 'Details of Group A',
      categoryId: Date.now(),
      categoryName: 'Test Category',
      parentId: Date.now(),
      metaData: {},
      address: {
        country: 'Uganda',
        district: 'Kampala',
        placeId: String(Date.now()),
        name: 'A Random Place',
        latitude: Date.now(),
        longitude: Date.now(),
        geoCoordinates: String(Date.now()),
        vicinity: String(Date.now()),
      },
    };

    const rawRequest = { user: { id: 1 }, headers: {} };
    const result = await controller.update(dto, rawRequest);

    expect(result).toEqual({
      id: dto.id,
      privacy: dto.id,
      name: dto.name,
      details: dto.details,
      categoryId: dto.categoryId,
      category: {
        id: dto.categoryId,
        name: expect.any(String),
      },
      parentId: dto.parentId,
      parent: {
        id: dto.parentId,
        name: expect.any(String),
      },
    });
  });
});
