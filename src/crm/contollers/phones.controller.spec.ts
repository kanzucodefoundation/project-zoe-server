import { Test, TestingModule } from "@nestjs/testing";
import { PhoneDto } from "../dto/phone.dto";
import Phone from "../entities/phone.entity";
import { PhonesService } from "../phones.service";
import { PhonesController } from "./phones.controller"

describe('Phones Controller', () => {
    let controller: PhonesController;

    const mockPhonesService = {
        create: jest.fn((data) => {
            return [
                new Phone,
                new Phone,
            ]
        }),
        update: jest.fn((data) => new Phone),
        remove: jest.fn(() => {}),
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PhonesController],
            providers: [PhonesService],
        })
            .overrideProvider(PhonesService)
            .useValue(mockPhonesService)
            .compile()

        controller = module.get<PhonesController>(PhonesController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a phone', async () => {
        const result = await controller.create(new PhoneDto)
        result.forEach((it) => {
            expect(it).toEqual(expect.any(Phone))
        })
    });

    it('should update a phone', async () => {
        const result = await controller.update(new PhoneDto)
        expect(result).toEqual(expect.any(Phone)); 
    });

    it('should remove a phone', async () => {
        const id = Math.floor(Math.random() * 100);
        const result = await controller.remove(id);
        expect(result).toBeUndefined();
    });
})
