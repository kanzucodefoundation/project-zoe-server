import { Injectable, Logger, Inject } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import { CreateEventActivityDto } from './dto/create-event-activity.dto';
import EventActivitiesSearchDto from './dto/event-activities-search.dto';
import { UpdateEventActivityDto } from './dto/update-event-activity.dto';
import { EventActivity } from './entities/event-activity.entity';

@Injectable()
export class EventActivitiesService {
  private readonly repository: Repository<EventActivity>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(EventActivity);
  }

  async create(data: EventActivity): Promise<EventActivity> {
    //console.log(data);
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
  async findAll(): Promise<CreateEventActivityDto[]> {
    console.log('findin all');
    const data = await this.repository.find({
      relations: ['event'],
    });
    return data;
  }

  async findOne(id: number): Promise<EventActivity> {
    return await this.repository.findOne({ where: { id } });
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
