import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Report } from './report.entity';

@Entity()
@Index(['tenant', 'report', 'metricKey'], { unique: true })
export class MetricFieldMap {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Report, { nullable: false })
  report: Report;

  @Column()
  metricKey: string;

  @Column()
  reportFieldName: string;

  @CreateDateColumn()
  createdAt: Date;
}
