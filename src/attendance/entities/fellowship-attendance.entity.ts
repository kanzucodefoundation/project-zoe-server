import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { FellowshipInstance } from './fellowship-instance.entity';
import Contact from '../../crm/entities/contact.entity';

@Entity()
@Index(['fellowshipInstanceId', 'contactId'], { unique: true })
@Index(['tenant', 'fellowshipInstance'])
export class FellowshipAttendance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => FellowshipInstance, (instance) => instance.attendance, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  fellowshipInstance: FellowshipInstance;

  @Column()
  fellowshipInstanceId: number;

  @ManyToOne(() => Contact, { nullable: false })
  contact: Contact;

  @Column()
  contactId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  checkedInAt: Date;

  @ManyToOne(() => User, { nullable: false })
  checkedInBy: User;

  @Column({ default: true })
  isMember: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
