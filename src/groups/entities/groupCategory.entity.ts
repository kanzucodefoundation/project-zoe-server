import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Group from './group.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { GroupCategoryPurpose } from '../enums/groups';

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

  /**
   * Classifies this category into one of the four system domains.
   * See GroupCategoryPurpose for the full design explanation.
   * Nullable so existing categories are unaffected until explicitly stamped.
   */
  @Column({ type: 'enum', enum: GroupCategoryPurpose, nullable: true })
  purpose?: GroupCategoryPurpose;

  @OneToMany((type) => Group, (it) => it.category, {
    cascade: ['insert', 'remove'],
  })
  groups: Group[];
}
