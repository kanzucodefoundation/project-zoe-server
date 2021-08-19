import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindConditions, Repository, Like } from "typeorm";
import { ContactSearchDto } from "./dto/contact-search.dto";
import Company from "./entities/company.entity";
import { hasValue } from "src/utils/validation";
import { CreateCompanyDto } from "./dto/create-company.dto";
import CompanyListDto from "./dto/company-list.dto";
import { ContactsService } from "./contacts.service";
import ContactListDto from "./dto/contact-list.dto";

@Injectable()
export class CompanyService {
    constructor(
        @InjectRepository(Company)
        private readonly repository: Repository<Company>,
        private readonly contactService: ContactsService,
    ) {}

    async findAll(req: ContactSearchDto): Promise<Company[]> {
        let q: FindConditions<Company>[] = [];
        if (hasValue(req.query)) {
        q = [
            {
            name: Like(`${req.query}%`),
            },
        ];
        }
        return await this.repository.find({
        where: q,
        skip: req.skip,
        take: req.limit,
        });
    }

    async findCombo(req: ContactSearchDto): Promise<CompanyListDto[]> {
        const data = await this.repository.find({
        select: ['id', 'name'],
        skip: req.skip,
        take: req.limit,
        });
        return data.map((it) => ({
        id: it.id,
        name: it.name,
        }));
    }

    async create(data: CreateCompanyDto): Promise<ContactListDto> {
        const contact = await this.contactService.createCompany(data);
        return ContactsService.toListDto(contact);
    }

    async update(data: Company): Promise<Company> {
        return await this.repository.save(data);
    }
}

