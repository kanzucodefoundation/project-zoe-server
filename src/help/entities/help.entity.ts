import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { URLCategory } from '../enums/URLCategory';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity({ name: 'help' })
@Index(['tenant', 'id'])
export default class Help {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.helpArticles, { nullable: false })
  tenant: Tenant;

  @Column({ length: 300 })
  title: string;

  @Column({ nullable: false })
  url?: string;

  @Column({
    type: 'enum',
    enum: URLCategory,
    nullable: true,
  })
  category: URLCategory;

  @CreateDateColumn({
    default: () => 'NOW()',
    nullable: false,
  })
  createdOn: Date;

  @UpdateDateColumn({
    default: () => 'NOW()',
    nullable: false,
  })
  modifiedOn: Date;
}
