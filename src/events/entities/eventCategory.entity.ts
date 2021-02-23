import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import GroupEvent from './event.entity';
import EventField from './eventField.entity';

@Entity()
export default class EventCategory {
  @PrimaryColumn({ length: 40 })
  id: string;

  @Column({ length: 200 })
  name: string;

  @OneToMany(
    type => GroupEvent,
    it => it.category,
    {
      cascade: ['insert', 'remove'],
    },
  )
  events: GroupEvent[];

  @OneToMany(
    type => EventField,
    it => it.category,
    {
      cascade: ['insert', 'remove'],
    },
  )
  fields: EventField[];
}
