import Contact from '../../crm/entities/contact.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from './group.entity';

@Entity()
export default class GroupMembershipRequest extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @JoinColumn()
  @ManyToOne((type) => Contact, (it) => it.groupMembershipRequests)
  contact: Contact;

  @Column()
  contactId: number;

  @Column({ nullable: true })
  parentId?: number;

  @JoinColumn()
  @ManyToOne((type) => Group, (it) => it.groupMembershipRequests)
  group: Group;

  @Column()
  groupId: number;

  @Column()
  distanceKm?: number | null;
}
