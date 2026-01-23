import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from './group.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
@Index(['tenant', 'id'])
export default class GroupCategory {
  @Column()
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.groupCategories, {
    nullable: false,
  })
  tenant: Tenant;

  @Column({ length: 200 })
  name: string;

  @OneToMany((type) => Group, (it) => it.category, {
    cascade: ['insert', 'remove'],
  })
  groups: Group[];
}
