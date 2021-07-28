import { Test, TestingModule } from "@nestjs/testing";
import { GroupRole } from "../enums/groupRole";
import { GroupsMembershipService } from "../services/group-membership.service";
import { GroupMembershipController } from "./group-membership.controller"

describe('Group Membership', () => {
    let controller: GroupMembershipController;

    const mockGroupMembershipService = {
        create: jest.fn((dto) => {
            return dto.members.length;
        }),
        remove: jest.fn((id) => {
            
        })
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GroupMembershipController],
            providers: [GroupsMembershipService],
        })
            .overrideProvider(GroupsMembershipService)
            .useValue(mockGroupMembershipService)
            .compile()

        controller = module.get<GroupMembershipController>(GroupMembershipController);
    })

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a team/group member', async () => {
        const dto = {
            groupId: Date.now(),
            members: [
                Math.floor(Math.random() * 10),
                Math.floor(Math.random() * 10),
                Math.floor(Math.random() * 10),
                Math.floor(Math.random() * 10)
            ],
            role: GroupRole.Member,
        }
        const result = await controller.create(dto);
        expect(result).toEqual({
            message: "Operation succeeded",
            inserted: dto.members.length,
        });
    });
    it('should remove a team/group member', async () => {
        const result = await controller.remove(Date.now());
        expect(result).toBeUndefined();
    });
});

