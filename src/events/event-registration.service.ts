import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getPersonFullName } from 'src/crm/crm.helpers';
import { Repository } from 'typeorm';
import EventRegistrationSearchDto from './dto/even-registration-search.dto';
import EventRegistartion from './dto/event-registration.dto';
import EventRegistration from './entities/eventRegistration.entity';

@Injectable()
export class EventRegistrationService {
  constructor(
    @InjectRepository(EventRegistration)
    private readonly repository: Repository<EventRegistration>,
  ) {}
  async create(data: EventRegistartion): Promise<any> {
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
    let responseDTO: any[] = [];
    for (let i = 0; i < data.length; i++) {
      let eventData = {
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
