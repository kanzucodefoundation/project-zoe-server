import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';

@Injectable()
export class VisitorsService {
    constructor(
        @InjectRepository(Visitor)
        private readonly userRepo: Repository<Visitor>,
    ){}
    
    findAll():Promise<Visitor[]>{
        return this.userRepo.find();
    }

    //Register Visitor Method
    async create(data: Visitor): Promise<Visitor> {
        return await this.userRepo.save(data);
    }
    
}
