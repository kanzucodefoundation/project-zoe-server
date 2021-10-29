import { contact } from '@prisma/client';
import Contact from 'src/crm/entities/contact.entity';
import { Column, JoinColumn, ManyToOne, PrimaryGeneratedColumn, OneToMany, Entity } from 'typeorm';
import { EventActivity } from './event-activity.entity';

@Entity()
export class MemberEventActivities {
@PrimaryGeneratedColumn()
id:number;

@OneToMany((type) => EventActivity, (it) => it.member)
@JoinColumn()
activities?:EventActivity;

@Column()
activityId:number;

@ManyToOne((type) => Contact, (it) => it.member)
@JoinColumn()
contact?:Contact;

@Column()
contactId:number;

}
