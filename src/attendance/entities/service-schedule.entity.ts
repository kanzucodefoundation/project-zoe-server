import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { ServiceInstance } from './service-instance.entity';

@Entity()
@Index(['tenant', 'isActive'])
export class ServiceSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ length: 200 })
  name: string;

  @ManyToOne(() => Group, { nullable: false })
  location: Group;

  @Column()
  locationGroupId: number;

  @Column({ type: 'varchar', length: 20 })
  serviceType: 'Sunday' | 'Midweek' | 'Special';

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'varchar', length: 20 })
  frequency: 'weekly' | 'biweekly' | 'monthly';

  @Column({ type: 'int', array: true })
  daysOfWeek: number[];

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metaData?: {
    expectedAttendance?: number;
    hasChildrensProgram?: boolean;
    livestreamEnabled?: boolean;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @OneToMany(() => ServiceInstance, (instance) => instance.schedule)
  instances: ServiceInstance[];
}
