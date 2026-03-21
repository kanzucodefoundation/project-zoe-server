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
import { FellowshipSchedule } from './fellowship-schedule.entity';
import { FellowshipAttendance } from './fellowship-attendance.entity';
import Group from '../../groups/entities/group.entity';

@Entity()
@Index(['tenant', 'meetingDate', 'scheduleId'])
export class FellowshipInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ type: 'date' })
  @Index()
  meetingDate: string;

  @ManyToOne(() => FellowshipSchedule, (schedule) => schedule.instances, {
    nullable: false,
  })
  schedule: FellowshipSchedule;

  @Column()
  scheduleId: number;

  @ManyToOne(() => Group, { nullable: false })
  fellowshipGroup: Group;

  @Column()
  fellowshipGroupId: number;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';

  @Column({ type: 'int', default: 0 })
  cachedMemberCount: number;

  @Column({ type: 'int', default: 0 })
  cachedVisitorCount: number;

  @Column({ type: 'int', default: 0 })
  cachedTotalCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @OneToMany(() => FellowshipAttendance, (att) => att.fellowshipInstance)
  attendance: FellowshipAttendance[];
}
