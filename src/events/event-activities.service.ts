import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEventActivityDto } from '../events/dto/create-event-activity.dto';
import { UpdateEventActivityDto } from './dto/update-event-activity.dto';
import { EventActivity } from './entities/event-activity.entity';
import { EventActivityRepository } from '../events/event-activities-repository';
import { Repository } from 'typeorm';

@Injectable()
export class EventActivitiesService {
  constructor(
    @InjectRepository(EventActivity)
    private readonly eventActivityRepository:Repository <EventActivity>,
  ) {}

  create(EventActivity: CreateEventActivityDto):Promise<CreateEventActivityDto  | any >  {

    return `This action adds a new eventActivity`;
  }

  findAll() {
    return `This action returns all eventActivities`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventActivity`;
  }

  update(id: number, updateEventActivityDto: UpdateEventActivityDto) {
    return `This action updates a #${id} eventActivity`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventActivity`;
  }
}
