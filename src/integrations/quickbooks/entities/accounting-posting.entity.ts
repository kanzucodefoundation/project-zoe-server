import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import Transaction from '../../../finance/entities/transaction.entity';
import { User } from '../../../users/entities/user.entity';

export enum AccountingPostingSystem {
  QUICKBOOKS = 'QUICKBOOKS',
}

export enum AccountingPostingDocumentType {
  SALES_RECEIPT = 'SALES_RECEIPT',
}

export enum AccountingPostingStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  FAILED = 'FAILED',
}

@Entity()
@Index(['tenantId', 'transactionId'])
@Index(['tenantId', 'status'])
export class AccountingPosting {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column()
  tenantId: number;

  @ManyToOne(() => Transaction, { nullable: false })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @Column({
    type: 'enum',
    enum: AccountingPostingSystem,
    default: AccountingPostingSystem.QUICKBOOKS,
  })
  system: AccountingPostingSystem;

  @Column({
    type: 'enum',
    enum: AccountingPostingDocumentType,
    default: AccountingPostingDocumentType.SALES_RECEIPT,
  })
  documentType: AccountingPostingDocumentType;

  @Column({
    type: 'enum',
    enum: AccountingPostingStatus,
    default: AccountingPostingStatus.PENDING,
  })
  status: AccountingPostingStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalDocumentId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalDocumentNumber: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => User, { nullable: true })
  requestedBy: User | null;

  @Column({ nullable: true })
  requestedById: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  requestedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
