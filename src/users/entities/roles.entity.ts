import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import UserRoles from './userRoles.entity';

@Entity()
@Unique(['role'])
export default class Roles {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  role: string;

  @Column({ nullable: false })
  description: string;

  @Column('simple-array', { nullable: false })
  permissions: string[];

  @Column({ nullable: false })
  isActive: Boolean;

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
