import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEventActivityDto } from '../events/dto/create-event-activity.dto';
import { UpdateEventActivityDto } from './dto/update-event-activity.dto';

import { Repository } from 'typeorm';
import { EventActivity } from './entities/event-activity.entity';

@Injectable()
export class EventActivitiesService {
  constructor(
    @InjectRepository(EventActivity)
    private readonly repository: Repository<EventActivity>,
  ) {}
    
  async create(data: CreateEventActivityDto) {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        name: data.name,
        eventId: data.eventId,
      

      })
      .execute();
      console.log("creatingdata");
  
    return result;
   
  }

  findAll() {
    return `This action returns all eventActivities`;
  }

  async findOne(id: number):Promise<CreateEventActivityDto>{
    console.log("finding one");
    const data = await this.repository.findOne(id);
    return data;
  }

  async update(dto: UpdateEventActivityDto): Promise< UpdateEventActivityDto>{
    console.log("updating activity");
    const result = await this.repository
      .createQueryBuilder()
      .update(EventActivity)
      .set({
        ...dto,
      })
      .where('id = :id', { id: dto.id})
      .execute();
    if (result.affected)
      Logger.log(
        `Update.EventActivity eventId:${dto.id} affected:${result.affected} complete`,
      );
    return await this.findOne(dto.id);
      
    
  }

  async remove(id: number):Promise<void> {
    console.log("removing an activity");
    await this.repository.delete(id);
   
  }
}
