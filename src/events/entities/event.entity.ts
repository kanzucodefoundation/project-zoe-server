import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventPrivacy } from '../enums/EventPrivacy';
import EventCategory from './eventCategory.entity';
import Group from '../../groups/entities/group.entity';
import InternalAddress from '../../shared/entity/InternalAddress';
import EventAttendance from './eventAttendance.entity';
import Person from 'src/crm/entities/person.entity';
import EventRegistration from './eventRegistration.entity';

@Entity({ name: 'events' })
export default class GroupEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: EventPrivacy,
    nullable: true,
  })
  privacy: EventPrivacy;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, nullable: true })
  summary?: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @ManyToOne((type) => Person, (it) => it.contactId)
  submittedBy: Person;

  @Column({ nullable: true })
  submittedById?: number;

  @Column({
    nullable: true,
    type: 'jsonb',
  })
  venue?: InternalAddress;

  @ManyToOne((type) => EventCategory, (it) => it.events)
  @JoinColumn()
  category: EventCategory;

  @Column({ nullable: false, length: 40 })
  categoryId: string;

  @ManyToOne((type) => Group, (it) => it.children)
  group: Group;

  @Column({ nullable: true })
  groupId: number;

  @Column({ nullable: true })
  parentId: number;

  @OneToMany((type) => EventAttendance, (it) => it.event)
  attendance: EventAttendance[];

  @OneToMany((type) => EventRegistration, (it) => it.event)
  registration: EventRegistration[];

  @Column({
    nullable: true,
    type: 'jsonb',
  })
  metaData?: any;
}
