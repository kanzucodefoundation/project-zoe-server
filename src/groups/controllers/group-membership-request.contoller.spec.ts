import { Test, TestingModule } from '@nestjs/testing';
import ComboDto from 'src/shared/dto/combo.dto';
import GroupMembershipRequestDto from '../dto/membershipRequest/group-membership-request.dto';
import { GroupMembershipRequestService } from '../services/group-membership-request.service';
import { GroupMembershipReqeustController } from './group-membership-request.contoller';

describe('Groups Membership Request', () => {
  let controller: GroupMembershipReqeustController;

  const mockGroupMembershipRequestService = {
    findAll: jest.fn((dto) => {
      return [
        {
          id: Math.floor(Math.random() * 10),
          contactId: dto.contactId ? dto.contactId : Math.floor(Math.random() * 10),
          parentId: dto.parentId ? dto.parentId : Math.floor(Math.random() * 10),
          groupId: dto.groupId ? dto.groupId : Math.floor(Math.random() * 10),
          distanceKm: Math.floor(Math.random() * 10),
          group: {
            id: dto.groupId ? dto.groupId : Math.floor(Math.random() * 10),
            name: 'Testing Group',
            parent: {
              id: dto.parentId ? dto.parentId : Math.floor(Math.random() * 10),
              name: "Parent Group Name"
            },
          },
          contact: {
            id: dto.contactId ? dto.contactId : Math.floor(Math.random() * 10),
            fullName: 'John Doe',
            avatar: 'http://avatar.com/001',
          },
        },
      ]
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

  it('should return the pending request for a user', async () => {
    const dto = {contactId: Math.floor(Math.random() * 10)};
    const result = await controller.findAll(dto)
    expect(result.length).toBe(1)
    result.forEach((it) => {
      expect(it).toEqual({
        id: expect.any(Number),
        contactId: dto.contactId,
        groupId: expect.any(Number),
        distanceKm: expect.any(Number),
        parentId: expect.any(Number),
        group: {
          id: expect.any(Number),
          name: expect.any(String),
          parent: {
            id: expect.any(Number),
            name: expect.any(String)
          },
        },
        contact: {
          id: dto.contactId,
          fullName: expect.any(String),
          avatar: expect.any(String),
        },
      })
    })
  });

  it('should return the pending requests for a group', async () => {
    const dto = {groupId: Math.floor(Math.random() * 10)};
    const expectedObj = {
      id: expect.any(Number),
      contactId: expect.any(Number),
      groupId: dto.groupId,
      distanceKm: expect.any(Number),
      parentId: expect.any(Number),
      group: {
        id: dto.groupId,
        name: expect.any(String),
        parent: {
          id: expect.any(Number),
          name: expect.any(String)
        },
      },
      contact: {
        id: expect.any(Number),
        fullName: expect.any(String),
        avatar: expect.any(String),
      },
    }
    const result = await controller.findAll(dto)
    result.forEach((it) => {
      expect(it).toEqual(expectedObj);
    })
  });

});
