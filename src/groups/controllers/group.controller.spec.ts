import { Test, TestingModule } from '@nestjs/testing';
import ComboDto from 'src/shared/dto/combo.dto';
import { GroupsService } from '../services/groups.service';
import { GroupController } from './group.controller';
import GroupListDto from '../dto/group-list.dto';

describe('GroupController', () => {
  let controller: GroupController;

  const mockGroupService = {
    findOne: jest.fn((id, full = true) => {
      return {
        id: id,
        name: 'Group Name',
        details: 'Group Details',
        parentId: Math.floor(Math.random() * 1000),
        privacy: 'Private',
        category: new ComboDto(),
        parent: new ComboDto(),
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [GroupsService],
    })
      .overrideProvider(GroupsService)
      .useValue(mockGroupService)
      .compile();

    controller = module.get<GroupController>(GroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should display the group details for a particular group', async () => {
    const result = await controller.findOne(Math.floor(Math.random() * 1000));
    const groupDetails: GroupListDto = {
      id: expect.any(Number),
      name: expect.any(String),
      details: expect.any(String),
      parentId: expect.any(Number),
      privacy: expect.any(String),
      category: expect.any(ComboDto),
      parent: expect.any(ComboDto),
    };
    expect(result).toEqual(groupDetails);
  });
});
