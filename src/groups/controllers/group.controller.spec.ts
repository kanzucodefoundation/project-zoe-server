import { Test, TestingModule } from "@nestjs/testing"
import { GroupsService } from "../services/groups.service";
import { GroupController } from "./group.controller"

describe('GroupController', () => {
    let controller: GroupController;

    const mockGroupService = {
        findAll: jest.fn((req) => {
            return [
                {
                    id: Date.now(),
                    privacy: "Public",
                    name: "Group A",
                    details: "Details of Group A",
                    categoryId: "A Category",
                    category: {
                        id: "A Category",
                        name: "A Category"
                    },
                    parentId: Date.now(),
                    parent: {
                        id: Date.now(),
                        name: "Parent A"
                    }
                },
            ]
        })
    };

    beforeEach( async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GroupController],
            providers: [GroupsService],
        })
            .overrideProvider(GroupsService)
            .useValue(mockGroupService)
            .compile();

        controller = module.get<GroupController>(GroupController);
    })

    it('should be defined', () => {
        expect(controller).toBeDefined();
    })

    it('should display a list of public groups', async () => {

        const expectedObj = {
            id: expect.any(Number),
            privacy: expect.any(String),
            name: expect.any(String),
            details: expect.any(String),
            categoryId: expect.any(String),
            category: { 
                id: expect.any(String),
                name: expect.any(String)
            },
            parentId: expect.any(Number),
            parent: { 
                id: expect.any(Number),
                name: expect.any(String)
            },
        }
        const req = {};
        const result = await controller.findAll(req);
        result.forEach((it) => {
            expect(it).toMatchObject(expectedObj)
        })
    })
})

