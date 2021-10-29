import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import Roles from './roles.entity';
import { User } from './user.entity';

@Entity()
@Unique(['userId', 'rolesId'])
export default class UserRoles {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => User, (it) => it.userRoles, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne((type) => Roles, (it) => it.rolesUser, { onDelete: 'CASCADE' })
  roles: Roles;

  @Column()
  rolesId: number;
}
