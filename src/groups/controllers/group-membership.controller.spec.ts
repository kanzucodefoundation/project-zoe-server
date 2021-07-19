import { Test, TestingModule } from "@nestjs/testing";
import { GroupsMembershipService } from "../services/group-membership.service";
import { GroupMembershipController } from "./group-membership.controller";

describe('GroupMembershipController', () => {
    let controller: GroupMembershipController;

    const mockGroupMembershipService = {
        findAll: jest.fn((req) => {
            return [
                    {
                    id: Date.now(),
                    isInferred: true,
                    group: {
                        id: Date.now(),
                        name: "Group B",
                    },
                    groupId: Date.now(),
                    contact: {
                        id: req.contactId,
                        name: "John Doe",
                    },
                    contactId: Date.now(),
                    role: "Leader",
                    category: {
                        id: Date.now(),
                        name: "A Category"
                    }
                },
                {
                    id: Date.now(),
                    isInferred: true,
                    group: {
                        id: Date.now(),
                        name: "Group B",
                    },
                    groupId: Date.now(),
                    contact: {
                        id: req.contactId,
                        name: "John Doe"
                    },
                    contactId: Date.now(),
                    role: "Member",
                },
            ];
        })
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GroupMembershipController],
            providers: [GroupsMembershipService],
        })
            .overrideProvider(GroupsMembershipService)
            .useValue(mockGroupMembershipService)
            .compile();
        
        controller = module.get<GroupMembershipController>(GroupMembershipController)
    });

    it('should be defined', () => {
        expect(controller).toBeDefined()
    });

    it('should list all groups a user belongs to', async () => {

        const dto = {
            contactId: Date.now()
        }

        const expectedObj = {
            id: expect.any(Number) || undefined,
            isInferred: expect.any(Boolean),
            group: {
                id: expect.any(Number),
                name: expect.any(String),
            },
            groupId: expect.any(Number),
            contact: {
                id: dto.contactId,
                name: expect.any(String)
            },
            contactId: expect.any(Number),
            role: expect.any(String),
        }

        const result = await controller.findAll(dto);
        result.forEach((it) => {
            expect(it).toMatchObject(expectedObj)
        })
    });
})

