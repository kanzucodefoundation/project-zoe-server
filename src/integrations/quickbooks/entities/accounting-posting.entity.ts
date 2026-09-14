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

/**
 * One posting per transaction, and the arbiter for the claim's ON CONFLICT.
 *
 * Declared here as well as in its migration because development runs with
 * `DB_SYNCHRONIZE=true`: schema sync drops any index the entity does not know
 * about, so an index that lived only in the migration disappeared on the next
 * app start and posting failed with "no unique or exclusion constraint matching
 * the ON CONFLICT specification". The name matches the migration's exactly, so
 * the two agree rather than each creating their own.
 */
@Entity()
@Index(
  'UQ_accounting_posting_tenant_transaction_doc',
  ['tenantId', 'transactionId', 'system', 'documentType'],
  { unique: true },
)
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
