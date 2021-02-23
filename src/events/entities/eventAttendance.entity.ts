import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import GroupEvent from './event.entity';
import Contact from '../../crm/entities/contact.entity';

@Entity()
export default class EventAttendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  isVisitor: boolean;

  @ManyToOne(
    type => GroupEvent,
    it => it.attendance,
  )
  @JoinColumn()
  event: GroupEvent;
  eventId: string;

  @ManyToOne(
    type => Contact,
    it => it.attendance,
  )
  @JoinColumn()
  contact: Contact;
  contactId: number;
}
