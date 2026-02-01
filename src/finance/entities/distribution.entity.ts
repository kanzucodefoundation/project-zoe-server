import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import ReconciliationMatch from './reconciliation-match.entity';
import DistributionBatch from './distribution-batch.entity';
import Group from '../../groups/entities/group.entity';
import FinancialAccount from './financial-account.entity';
import { TransactionCategory } from '../enums/transaction-category.enum';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'batch'])
@Index(['tenant', 'match'])
export default class Distribution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => ReconciliationMatch, (match) => match.distributions, {
    nullable: false,
  })
  match: ReconciliationMatch;

  @ManyToOne(() => DistributionBatch, (batch) => batch.distributions, {
    nullable: true,
  })
  batch: DistributionBatch;

  @Column({
    type: 'enum',
    enum: TransactionCategory,
    nullable: true,
  })
  category: TransactionCategory;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Group, { nullable: true })
  targetGroup: Group;

  @ManyToOne(() => FinancialAccount, (account) => account.distributions, {
    nullable: true,
  })
  targetAccount: FinancialAccount;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
