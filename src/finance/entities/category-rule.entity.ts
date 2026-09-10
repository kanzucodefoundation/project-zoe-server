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
import FinancialAccount from './financial-account.entity';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { RuleConditions } from '../dto/category-rule-conditions';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'account', 'priority'])
export default class CategoryRule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: TransactionCategory,
  })
  category: TransactionCategory;

  /**
   * Either the rule-builder object (accounts / keywords / daysOfWeek /
   * timeRange / dateRange) or, for rules written before the builder existed,
   * the original array of field/operator/value conditions. Both live happily
   * in jsonb, so no migration is needed to read the old ones.
   */
  @Column({ type: 'jsonb' })
  conditions: RuleConditions;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => FinancialAccount, (account) => account.categoryRules, {
    nullable: true,
  })
  account: FinancialAccount;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
