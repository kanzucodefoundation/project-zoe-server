import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import SearchDto from "src/shared/dto/search.dto";
import { Repository } from "typeorm";
import Relationship from "./entities/relationship.entity";

@Injectable()
export class RelationshipsService {
    constructor(
        @InjectRepository(Relationship)
        private readonly repository: Repository<Relationship>,
    ) {}

    async findAll(req: SearchDto): Promise<Relationship[]> {
        return await this.repository.find({
            skip: req.skip,
            take: req.limit,
        });
    }

    async create(data: Relationship): Promise<Relationship> {
        return await this.repository.save(data);
    }

    async update(data: Relationship): Promise<Relationship> {
        return await this.repository.save(data);
    }

    async findOne(id: number): Promise<Relationship> {
        return await this.repository.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.repository.delete(id);
    }
}

