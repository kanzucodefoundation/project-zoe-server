import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import EventActivitiesSearchDto from './dto/event-activities-search.dto';
import { UpdateEventActivityDto } from './dto/update-event-activity.dto';
import { EventActivity } from './entities/event-activity.entity';

@Injectable()
export class EventActivitiesService {
  constructor(
    @InjectRepository(EventActivity)
    private readonly repository: Repository<EventActivity>,
  ) {}

  async create(data: EventActivity): Promise<EventActivity> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        name: data.name,
        eventId: data.eventId,
      })
      .execute();
    console.log(result);
    Logger.log('Event Activity added successfully');

    return data;
  }
  //Get all activities.
  async findAll(req: EventActivitiesSearchDto): Promise<EventActivity[]> {
    console.log('findin all', req);
    const data = await this.repository.find({
      where: { eventId: req.eventId },
      relations: ['event'],
    });
    return data;
  }

  async findOne(id: number): Promise<EventActivity> {
    return await this.repository.findOne(id);
  }

  async update(dto: UpdateEventActivityDto): Promise<UpdateEventActivityDto> {
    const result = await this.repository
      .createQueryBuilder()
      .update(EventActivity)
      .set({
        name: dto.name,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (result.affected)
      Logger.log(
        `Update.EventActivity id: ${dto.id} affected:${result.affected} complete`,
      );
    return await this.findOne(dto.id);
  }
  async remove(id: number): Promise<void> {
    console.log('removing an activity');
    await this.repository.delete(id);
  }
}
