import {MemberEventActivities } from './member-event-activities.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import GroupEvent from './event.entity';

@Entity()
export class EventActivity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @ManyToOne((type) => GroupEvent, (it) => it.activity)
  @JoinColumn()
  event: GroupEvent;
  @Column()
  eventId: number;
  
  @ManyToOne((type) => MemberEventActivities, (it) => it.activity,{
     cascade: ['insert'],
  })
  member: MemberEventActivities[];
   
}
