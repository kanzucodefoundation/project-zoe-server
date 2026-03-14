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
import { ServiceInstance } from './service-instance.entity';
import Contact from '../../crm/entities/contact.entity';

@Entity()
@Index(['serviceInstanceId', 'contactId'], { unique: true })
@Index(['tenant', 'serviceInstance'])
@Index(['contact', 'checkedInAt'])
export class ServiceAttendance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => ServiceInstance, (instance) => instance.attendance, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  serviceInstance: ServiceInstance;

  @Column()
  serviceInstanceId: number;

  @ManyToOne(() => Contact, { nullable: false })
  contact: Contact;

  @Column()
  contactId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  checkedInAt: Date;

  @ManyToOne(() => User, { nullable: false })
  checkedInBy: User;

  @Column({ default: false })
  isFirstTime: boolean;

  @Column({ default: false })
  isChild: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
