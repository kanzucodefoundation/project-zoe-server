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
import { FellowshipInstance } from './fellowship-instance.entity';

@Entity()
@Index(['tenant', 'isActive'])
export class FellowshipSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Group, { nullable: false })
  fellowshipGroup: Group;

  @Column()
  fellowshipGroupId: number;

  @Column({ type: 'int' })
  meetingDay: number; // 0-6, 0 = Sunday

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  frequency: 'weekly' | 'biweekly' | 'monthly';

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @OneToMany(() => FellowshipInstance, (instance) => instance.schedule)
  instances: FellowshipInstance[];
}
