import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import UserRoles from './userRoles.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
@Index(['tenant', 'id'])
@Index(['role'])
export default class Roles {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.roles, { nullable: false })
  tenant: Tenant;

  @Column({ nullable: false })
  role: string;

  @Column({ nullable: false })
  description: string;

  @Column('simple-array', { nullable: false })
  permissions: string[];

  @Column({ nullable: false })
  isActive: boolean;

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

  @OneToMany((type) => UserRoles, (it) => it.roles)
  rolesUser: UserRoles[];
}
