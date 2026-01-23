import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import GroupEvent from './event.entity';
import EventField from './eventField.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
@Index(['tenant', 'name'], { unique: true })
@Index(['tenant', 'id'])
export default class EventCategory {
  @Column()
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.eventCategories, {
    nullable: false,
  })
  tenant: Tenant;

  @Column({ length: 200 })
  name: string;

  @OneToMany((type) => GroupEvent, (it) => it.category, {
    cascade: ['insert', 'remove'],
  })
  events: GroupEvent[];

  @OneToMany((type) => EventField, (it) => it.category, {
    cascade: ['insert', 'remove'],
  })
  fields: EventField[];
}
