import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import FinancialAccount from './financial-account.entity';
import ReconciliationMatch from './reconciliation-match.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'senderPhoneNormalized'])
@Index(['tenant', 'status'])
@Index(['tenant', 'transactionDate'])
export default class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => FinancialAccount, (account) => account.transactions, {
    nullable: false,
  })
  account: FinancialAccount;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  transactionDate: Date;

  @Column({ length: 100, nullable: true })
  externalReference: string;

  @Column({ length: 100, nullable: true })
  senderName: string;

  @Column({ length: 50, nullable: true })
  senderPhone: string;

  @Column({ length: 50, nullable: true })
  senderPhoneNormalized: string;

  @Column({ type: 'text', nullable: true })
  narration: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: TransactionCategory,
    nullable: true,
  })
  category: TransactionCategory;

  @Column({ type: 'jsonb', nullable: true })
  rawData: any;

  @OneToMany(() => ReconciliationMatch, (match) => match.transaction)
  matches: ReconciliationMatch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
