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
import Transaction from './transaction.entity';
import Contact from '../../crm/entities/contact.entity';
import Group from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import Distribution from './distribution.entity';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'status'])
@Index(['tenant', 'transaction'])
export default class ReconciliationMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Transaction, (transaction) => transaction.matches, {
    nullable: false,
  })
  transaction: Transaction;

  @ManyToOne(() => Contact, { nullable: true })
  contact: Contact;

  @ManyToOne(() => Group, { nullable: true })
  group: Group;

  @Column({
    type: 'enum',
    enum: MatchType,
    default: MatchType.AUTO,
  })
  matchType: MatchType;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.PENDING,
  })
  status: MatchStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidenceScore: number;

  @Column({ type: 'jsonb', nullable: true })
  matchCriteria: {
    method: string;
    matchedValue?: string;
    similarity?: number;
    historicalBonus?: boolean;
  };

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => Distribution, (distribution) => distribution.match)
  distributions: Distribution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
