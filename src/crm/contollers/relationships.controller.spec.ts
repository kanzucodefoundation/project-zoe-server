import { Test, TestingModule } from "@nestjs/testing";
import Relationship from "../entities/relationship.entity";
import { RelationshipsService } from "../relationships.service";
import { RelationshipsController } from "./relationships.controller"

describe('Relationships Controller', () => {
    let controller: RelationshipsController;

    const mockRelationshipService = {
        create: jest.fn(() => new Relationship),
        update: jest.fn(() => new Relationship),
        remove: jest.fn(() => {}),
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RelationshipsController],
            providers: [RelationshipsService],
        })
            .overrideProvider(RelationshipsService)
            .useValue(mockRelationshipService)
            .compile()
        
            controller = module.get<RelationshipsController>(RelationshipsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a relationship', async () => {
        const result = await controller.create(new Relationship);
        expect(result).toEqual(expect.any(Relationship));
    });

    it('should update a relationship', async () => {
        const result = await controller.update(new Relationship);
        expect(result).toEqual(expect.any(Relationship));
    });

    it('should remove a relationship', async () => {
        const id = Math.floor(Math.random() * 10);
        const result = await controller.remove(id);
        expect(result).toBeUndefined();
    });
})

