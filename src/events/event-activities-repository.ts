import { Repository, EntityRepository } from 'typeorm';
import { EventActivity } from '../events/entities/event-activity.entity';
import { CreateEventActivityDto } from './dto/create-event-activity.dto';

@EntityRepository(EventActivity)
export class EventActivityRepository extends Repository<CreateEventActivityDto> {

  public async EventActivity(createEventActivityDto: CreateEventActivityDto): Promise<EventActivity | any > {
    const  { eventActivityId, eventName, eventId } = createEventActivityDto;

    // const eventActivity = new EventActivity();
    EventActivity.eventActivityId = eventActivityId;
    EventActivity.eventName = eventName;
    EventActivity.eventId = eventId;
 
    await EventActivity.save();
    return EventActivity;
  }

  // public async editEventActivity(createEventActivityDto: CreateEventActivityDto,editedEventActivity: EventActivity ): Promise<EventActivity> {
  //   const { eventActivityId, eventName, eventId } = createEventActivityDto;

  //   editedEventActivity.eventActivityId = eventActivityId;
  //   editedEventActivity. eventName =  eventName;
  //   editedEventActivity.eventId = eventId;
  //   await editedEventActivity.save();

  //   return editedEventActivity;
  // }
}