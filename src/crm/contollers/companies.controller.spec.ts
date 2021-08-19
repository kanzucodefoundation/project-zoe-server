import { Test, TestingModule } from "@nestjs/testing";
import Company from "../entities/company.entity";
import { CompanyService } from "../company.service";
import { CompaniesController } from "./companies.controller";
import ComboDto from '../../shared/dto/combo.dto';

describe('Company Controller', () => {
    let controller: CompaniesController;

    const mockCompanyService = {
        create: jest.fn((dto) => {
            return {
                id: Math.floor(Math.random() * 10),
                name: dto.name,
                avatar: "expect.any(String)",
                ageGroup: "expect.any(String)",
                dateOfBirth: "expect.any(String)",
                email: dto.email,
                phone: dto.phone,
                cellGroup: new ComboDto,
                location: new ComboDto,
            }
        }),
        update: jest.fn((data) => new Company()),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CompaniesController],
            providers: [CompanyService],
        })
            .overrideProvider(CompanyService)
            .useValue(mockCompanyService)
            .compile()
        
        controller = module.get<CompaniesController>(CompaniesController);   
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create a company', async() => {
        const dto = {
            email: "johndoe@test.com",
            phone: "0712345678",
            name: "Company A"
        };

        const expectedObj = {
            id: expect.any(Number),
            avatar: expect.any(String),
            ageGroup: expect.any(String),
            dateOfBirth: expect.any(String),
            cellGroup: expect.any(ComboDto),
            location: expect.any(ComboDto),
        }
        const result = await controller.create(dto);
        expect(result).toEqual({
            ...dto,
            ...expectedObj
        });
    });

    it('should update a company', async () => {
        const data: Company = new Company();
        const result = await controller.update(data);
        expect(result).toEqual(expect.any(Company));
    });
})

