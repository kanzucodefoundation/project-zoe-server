import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { toCategoryDto } from "src/shared/mapper";
import { Repository } from "typeorm";
import { EventCategoryCreateDto } from "./dto/event-category-create.dto";
import { EventCategoryDto } from "./dto/event-category.dto";
import EventCategory from "./entities/eventCategory.entity";

@Injectable()
export class EventCategoryService {
    constructor(
        @InjectRepository(EventCategory)
        private readonly eventCategoryRepository: Repository<EventCategory>
    ){}

    async getAllCategory(): Promise<EventCategoryDto[]> {
        const categories = await this.eventCategoryRepository.find({relations:['fields']});
        return categories.map(category => toCategoryDto(category));
    }

    async createEventCategory(createEventCategoryDto: EventCategoryCreateDto): Promise<EventCategoryDto>{
        const {name} = createEventCategoryDto;

        const event_category: EventCategory = await this.eventCategoryRepository.create({
            name
        });

        await this.eventCategoryRepository.save(event_category);

        return toCategoryDto(event_category);
    }    

    async getOneCategory(id:number): Promise<EventCategoryDto>{

        const category = await this.eventCategoryRepository.findOne({
            where: {id},
            relations: ['fields'],
        });

        if (!category) {
            throw new HttpException(
                `Event Category does not exist`,
                HttpStatus.BAD_REQUEST,
            );
        }

        return toCategoryDto(category);
    }

  async updateCategory (id:number, eventCategoryDto: EventCategoryDto): Promise<EventCategoryDto>{
    const {name} = eventCategoryDto;

    let eventcategory: EventCategory = await this.eventCategoryRepository.findOne({where:{id}});
    if (!eventcategory) {
        throw new HttpException(
            `Event Category does not exist`,
            HttpStatus.BAD_REQUEST,
        );
    }

    eventcategory = {
        id,
        name,
    };

    await this.eventCategoryRepository.update({id},eventcategory); //update

    eventcategory = await this.eventCategoryRepository.findOne({
        where: {id},
        relations:['fields'],
    }); //re-query

    return toCategoryDto(eventcategory);
  }

    async deleteCategory(id:number): Promise<EventCategoryDto>{
        const eventcategory: EventCategory = await this.eventCategoryRepository.findOne({
            where: {id},
            relations:['fields'],
        });

        if (!eventcategory) {
            throw new HttpException(
                `Event Category does not exist`,
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.eventCategoryRepository.delete({id});

        return toCategoryDto(eventcategory);
    }
}