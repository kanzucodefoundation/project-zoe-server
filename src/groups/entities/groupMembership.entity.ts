import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import Group from './group.entity';

import { GroupRole } from '../enums/groupRole';
import Contact from '../../crm/entities/contact.entity';

@Entity()
@Unique(['contactId', 'groupId'])
export default class GroupMembership {
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

  @CreateDateColumn({ type: 'timestamp' })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date;

  @Column({ default: true })
  isActive: boolean;
}
