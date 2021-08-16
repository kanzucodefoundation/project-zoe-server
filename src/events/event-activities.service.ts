import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEventActivityDto } from '../events/dto/create-event-activity.dto';
import { UpdateEventActivityDto } from './dto/update-event-activity.dto';

import { Repository } from 'typeorm';
import { EventActivity } from './entities/event-activity.entity';


import EventActivitiesSearchDto from './dto/event-activities-search.dto';

@Injectable()
export class EventActivitiesService {
 
 
 

  constructor(
    @InjectRepository(EventActivity)
    private readonly repository: Repository<EventActivity>,
  ) {}
    
      
    async create(data:EventActivity):Promise<EventActivity>{
      return await this.repository.save(data);
    }


  async findAll(req:EventActivitiesSearchDto):Promise<EventActivity[]>{
    console.log("finding all");
    return await this.repository.find(req);

    
  }

  async findOne(id: number):Promise<EventActivity>{
    console.log("finding one");
    return await this.repository.findOne(id);
  
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
