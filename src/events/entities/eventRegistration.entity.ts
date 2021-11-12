import Contact from 'src/crm/entities/contact.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import GroupEvent from './event.entity';

@Entity()
@Unique(['eventId', 'contactId'])
export default class EventRegistration {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => GroupEvent, (it) => it.registration)
  @JoinColumn()
  event?: GroupEvent;

  @Column({ nullable: false })
  eventId: number;

  @ManyToOne((type) => Contact, (it) => it.registration)
  @JoinColumn()
  contact?: Contact;

  @Column({ nullable: false })
  contactId: number;
}
