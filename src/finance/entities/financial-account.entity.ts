import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import Group from '../../groups/entities/group.entity';
import { AccountType } from '../enums/account-type.enum';
import Transaction from './transaction.entity';
import Distribution from './distribution.entity';
import CategoryRule from './category-rule.entity';

@Entity()
@Index(['tenant', 'id'])
export default class FinancialAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, nullable: true })
  accountNumber: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    default: AccountType.BANK,
  })
  accountType: AccountType;

  @Column({ length: 10, default: 'UGX' })
  currency: string;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Group, { nullable: true })
  ownerGroup: Group;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];

  @OneToMany(() => Distribution, (distribution) => distribution.targetAccount)
  distributions: Distribution[];

  @OneToMany(() => CategoryRule, (rule) => rule.account)
  categoryRules: CategoryRule[];
}
