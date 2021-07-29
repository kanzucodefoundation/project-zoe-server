import { Test, TestingModule } from '@nestjs/testing';
import ComboDto from 'src/shared/dto/combo.dto';
import GroupMembershipRequestDto from '../dto/membershipRequest/group-membership-request.dto';
import { GroupMembershipRequestService } from '../services/group-membership-request.service';
import { GroupMembershipReqeustController } from './group-membership-request.contoller';

describe('Groups Membership Request', () => {
  let controller: GroupMembershipReqeustController;

  const mockGroupMembershipRequestService = {
    findAll: jest.fn((dto) => {
      return {
        id: Math.floor(Math.random() * 10),
        contactId: Math.floor(Math.random() * 10),
        parentId: Math.floor(Math.random() * 10),
        groupId: Math.floor(Math.random() * 10),
        distanceKm: Math.floor(Math.random() * 10),
        group: {
          id: Math.floor(Math.random() * 10),
          name: 'Testing Group',
          parent: new ComboDto(),
        },
        contact: {
          id: Math.floor(Math.random() * 10),
          fullName: 'John Doe',
          avatar: 'http://avatar.com/001',
        },
      };
    }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupMembershipReqeustController],
      providers: [GroupMembershipRequestService],
    })
      .overrideProvider(GroupMembershipRequestService)
      .useValue(mockGroupMembershipRequestService)
      .compile();

    controller = module.get<GroupMembershipReqeustController>(
      GroupMembershipReqeustController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return pending requests', async () => {
    const contactData = { contactId: Math.floor(Math.random() * 10) };
    const result = await controller.findAll(contactData);
    const apiOutput: GroupMembershipRequestDto = {
      id: expect.any(Number),
      contactId: expect.any(Number),
      groupId: expect.any(Number),
      distanceKm: expect.any(Number),
      parentId: expect.any(Number),
      group: {
        id: expect.any(Number),
        name: expect.any(String),
        parent: expect.any(ComboDto),
      },
      contact: {
        id: expect.any(Number),
        fullName: expect.any(String),
        avatar: expect.any(String),
      },
    };
    expect(result).toEqual(apiOutput);
  });
});
