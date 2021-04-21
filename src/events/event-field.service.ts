import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { toFieldDto } from "src/shared/mapper";
import { Repository } from "typeorm";
import { EventFieldCreateDto } from "./dto/event-field-create.dto";
import EventFieldDto from "./dto/event-field.dto";
import EventCategory from "./entities/eventCategory.entity";
import EventField from "./entities/eventField.entity";

@Injectable()
export class EventFieldService {
    constructor (
        @InjectRepository(EventField)
        private readonly eventFieldRepository: Repository<EventField>,
        @InjectRepository(EventCategory)
        private readonly eventCategoryRepository: Repository<EventCategory>,
    ){}

    async getOneField(id:number): Promise<EventFieldDto>{
        const field: EventField = await this.eventFieldRepository.findOne({where:{id}});

        if (!field){
            throw new HttpException (`Event Field does not exist`,HttpStatus.BAD_REQUEST);
        }

        return toFieldDto(field);
    }
    
    async createField(eventCategoryId:number, fieldDto: EventFieldCreateDto): Promise<EventFieldDto>{
        const {name, label,details,type,isRequired,categoryId} = fieldDto;

        const category: EventCategory = await this.eventCategoryRepository.findOne({
            where: {id: eventCategoryId},
            relations:['fields']
        });

        const field: EventField = await this.eventFieldRepository.create({
            name,
            label,
            details,
            type,
            isRequired,
            categoryId,
            category,
        });

        await this.eventFieldRepository.save(field);

        return toFieldDto(field);
    }

    async updateField(id: number, fieldDto: EventFieldDto): Promise<EventFieldDto>{
        const {name, label, details, type, isRequired, categoryId} = fieldDto;

        let field: EventField = await this.eventFieldRepository.findOne({where:{id}});

        if (!field){
            throw new HttpException (`Event Field does not exist`,HttpStatus.BAD_REQUEST);
        }

        field = {
            id,
            name,
            label,
            details,
            type,
            isRequired,
            categoryId
        };

        await this.eventFieldRepository.update({id},field); //update

        field = await this.eventFieldRepository.findOne({
            where:{id},
            relations:['fields'],
        }); //re-query

        return toFieldDto(field);

    }

    async getFieldbyCategory(id:number): Promise <EventFieldDto[]>{
        const fields: EventField[] = await this.eventFieldRepository.find({
            where: {category:{id}},
            relations:['category'],
        });

        return fields.map(field => toFieldDto(field));
    }

    async deleteField(id:number): Promise<EventFieldDto>{
        const field: EventField = await this.eventFieldRepository.findOne({where: {id}});

        if (!field){
            throw new HttpException (`Event Field does not exist`,HttpStatus.BAD_REQUEST);
        }

        await this.eventFieldRepository.delete({id});

        return toFieldDto(field);
    }



}