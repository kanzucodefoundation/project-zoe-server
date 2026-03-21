import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { ServiceSchedule } from './service-schedule.entity';
import { ServiceAttendance } from './service-attendance.entity';

@Entity()
@Index(['tenant', 'serviceDate', 'scheduleId'])
@Index(['serviceDate', 'status'])
export class ServiceInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ type: 'date' })
  @Index()
  serviceDate: string;

  @ManyToOne(() => ServiceSchedule, (schedule) => schedule.instances, {
    nullable: false,
  })
  schedule: ServiceSchedule;

  @Column()
  scheduleId: number;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';

  @Column({ type: 'int', default: 0 })
  cachedTotalCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @OneToMany(() => ServiceAttendance, (att) => att.serviceInstance)
  attendance: ServiceAttendance[];
}
