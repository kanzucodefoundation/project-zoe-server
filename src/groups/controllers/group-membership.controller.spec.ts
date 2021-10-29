import { Test, TestingModule } from '@nestjs/testing';
import ComboDto from 'src/shared/dto/combo.dto';
import { GroupsMembershipService } from '../services/group-membership.service';
import { GroupMembershipController } from './group-membership.controller';

describe('Group membership controller', () => {
  let controller: GroupMembershipController;

  const mockGroupsMembershipService = {
    findAll: jest.fn((dto) => {
      return {
        id: expect.any(Number),
        isInferred: true,
        group: new ComboDto(),
        groupId: Math.floor(Math.random() * 1000),
        contact: new ComboDto(),
        contactId: Math.floor(Math.random() * 1000),
        role: 'Leader',
        category: new ComboDto(),
      };
    }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupMembershipController],
      providers: [GroupsMembershipService],
    })
      .overrideProvider(GroupsMembershipService)
      .useValue(mockGroupsMembershipService)
      .compile();

    controller = module.get<GroupMembershipController>(
      GroupMembershipController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should return list of groups for user', async () => {
    const dto = { contactId: 1 };
    const result = await controller.findAll(dto);
    expect(result).toEqual({
      id: expect.any(Number),
      isInferred: expect.any(Boolean),
      group: expect.any(ComboDto),
      groupId: expect.any(Number),
      contact: expect.any(ComboDto),
      contactId: expect.any(Number),
      role: expect.any(String),
      category: expect.any(ComboDto),
    });
  });
});
