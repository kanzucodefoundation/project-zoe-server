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

  @Column({ type: 'jsonb' })
  conditions: {
    field: string;
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';
    value: string;
  }[];

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
