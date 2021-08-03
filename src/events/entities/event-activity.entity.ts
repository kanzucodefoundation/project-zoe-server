import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
// import  EventActivity from './event-activity.entity';

@Entity()
export class EventActivity {
  static save() {
    throw new Error('Method not implemented.');
  }
   
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column()
    name: string;
  
    @Column()
    eventId: number;
  static eventActivityId: any;
  static eventId: any;
  static eventName: any;
  

}
