import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import SearchDto from "src/shared/dto/search.dto";
import { Repository } from "typeorm";
import Email from "./entities/email.entity";

@Injectable()
export class EmailService {
    constructor(
        @InjectRepository(Email) private readonly repository: Repository<Email>,
    ){}

    async create(data: Email): Promise<Email>{
        return await this.repository.save(data);
    }

    async findAll(req: SearchDto): Promise<Email[]> {
        return await this.repository.find({
          skip: req.skip,
          take: req.limit,
        });
      }
    
      async update(data: Email): Promise<Email> {
        return await this.repository.save(data);
      }
    
      async findOne(id: number): Promise<Email> {
        return await this.repository.findOne(id);
      }
    
      async delete(id: number) {
        return await this.repository.delete(id);
      }
}