import { Injectable, Logger, Inject } from '@nestjs/common';
import { getPersonFullName } from 'src/crm/crm.helpers';
import { Repository, Connection } from 'typeorm';
import EventRegistrationSearchDto from './dto/even-registration-search.dto';
import EventRegistrationDto from './dto/event-registration.dto';
import EventRegistration from './entities/eventRegistration.entity';

@Injectable()
export class EventRegistrationService {
  private readonly repository: Repository<EventRegistration>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(EventRegistration);
  }
  async create(data: EventRegistrationDto): Promise<any> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        contactId: data.contactId,
        eventId: data.eventId,
      })
      .execute();

    Logger.log('Event Registration is successfully');
    return data;
  }

  // DTO response
  toDto(data: any): any {
    const responseDTO: any[] = [];
    for (let i = 0; i < data.length; i++) {
      const eventData = {
        id: data[i].id,
        contact: {
          id: data[i].contact.id,
          fullName: getPersonFullName(data[i].contact.person),
          avatar: data[i].contact.person.avatar,
        },
        event: {
          id: data[i].event.id,
          name: data[i].event.name,
          startDate: data[i].event.startDate,
          endDate: data[i].event.startDate,
          venue: data[i].event.venue.name,
          groupId: data[i].event.groupId,
        },
      };
      responseDTO.push(eventData);
    }

    return responseDTO;
  }

  async findOne(id: number): Promise<any> {
    //Find particular record given the id
    const data = await this.repository.findOne(id, {
      relations: ['event', 'contact', 'contact.person'],
    });
    //Refactoring into an array for Dto formatting
    const response: any[] = [];
    response.push(data);

    return this.toDto(response);
  }

  async findAll(req: EventRegistrationSearchDto): Promise<any> {
    const data = await this.repository.find({
      where: { contactId: req.contactId },
      relations: ['event', 'contact', 'contact.person'],
    });

    return this.toDto(data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
