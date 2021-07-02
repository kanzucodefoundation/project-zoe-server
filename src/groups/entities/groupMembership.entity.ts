import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from './group.entity';

import { GroupRole } from '../enums/groupRole';
import Contact from '../../crm/entities/contact.entity';

@Entity()
export default class GroupMembership extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @JoinColumn()
  @ManyToOne((type) => Group, (it) => it.members)
  group: Group;
  @Column()
  groupId: number;

  @JoinColumn()
  @ManyToOne((type) => Contact, (it) => it.groupMemberships)
  contact: Contact;

  @Column()
  contactId: number;

  @Column({
    type: 'enum',
    enum: GroupRole,
    nullable: true,
  })
  role: GroupRole;
}
