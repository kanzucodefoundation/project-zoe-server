import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import GroupEvent from './event.entity';
import Contact from '../../crm/entities/contact.entity';

@Entity()
@Unique(['eventId', 'contactId'])
export default class EventAttendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  isVisitor: boolean;

  @Column({ nullable: false })
  attended: boolean;

  @ManyToOne(
    type => GroupEvent,
    it => it.attendance,
  )
  @JoinColumn()
  event?: GroupEvent;

  @Column({ nullable: false })
  eventId: number;

  @ManyToOne(
    type => Contact,
    it => it.attendance,
  )
  @JoinColumn()
  contact?: Contact;

  @Column({ nullable: false })
  contactId: number;
}
