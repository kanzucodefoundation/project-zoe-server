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
  details?: string;

  @Column({ length: 25 })
  type: FieldType;

  @Column()
  isRequired: boolean;

  @ManyToOne(
    type => EventCategory,
    it => it.fields,
  )
  @JoinColumn()
  category?: EventCategory;
  @Column()
  categoryId: number;
}

export enum FieldType {
  Text = 'Text',
  Number = 'Number',
  Date = 'Date',
  //
  Array = 'Array',
}
