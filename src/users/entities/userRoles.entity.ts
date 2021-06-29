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
export default class UserRoles {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => User, (it) => it.userRoles)
  user: User;

  @ManyToOne((type) => Roles, (it) => it.rolesUser)
  roles: Roles;
}
