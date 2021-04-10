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

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ nullable: true })
  submittedBy?: string;

  @Column({ nullable: false, length: 500 })
  details: string;

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

  @Column({
    nullable: true,
    type: 'jsonb',
  })
  metaData?: any;
}
