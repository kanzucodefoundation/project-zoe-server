import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from './group.entity';
import EventCategory from 'src/events/entities/eventCategory.entity';
import { ReportFrequency } from '../enums/reportFrequency';
import GroupEvent from 'src/events/entities/event.entity';

@Entity()
export default class GroupReport {
  @PrimaryGeneratedColumn()
  id: number;

  @JoinColumn()
  @ManyToOne((type) => Group, (it) => it.reportCategories)
  group: Group;

  @Column()
  groupId: number;

  @JoinColumn()
  @ManyToOne((type) => EventCategory, (it) => it.reportingGroups)
  eventCategory: EventCategory;

  @Column()
  eventCategoryId: string;

  @Column({
    type: 'enum',
    enum: ReportFrequency,
    nullable: true,
  })
  frequency: ReportFrequency;
}
