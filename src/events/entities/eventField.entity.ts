import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import EventCategory from './eventCategory.entity';

@Entity()
export default class EventField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40 })
  name: string;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 200 })
  details: string;

  @Column({ length: 25 })
  type: string;

  @Column()
  isRequired: boolean;

  @ManyToOne(
    type => EventCategory,
    it => it.events,
  )
  @JoinColumn()
  category: EventCategory;
  @Column()
  categoryId: string;
}
