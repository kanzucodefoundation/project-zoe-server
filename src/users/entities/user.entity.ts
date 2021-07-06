import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import Contact from '../../crm/entities/contact.entity';
import { hasValue } from '../../utils/validation';
import UserRoles from './userRoles.entity';

// authentication will take approximately 13 seconds
// https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
const hashCost = 10;

@Entity()
@Unique(['username'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40 })
  username: string;

  @Column({ length: 100 })
  password: string;

  @OneToOne((type) => Contact)
  @JoinColumn()
  contact: Contact;

  @Column({ nullable: false })
  contactId: number;

  @Column()
  isActive: boolean;

  @OneToMany((type) => UserRoles, (it) => it.user)
  userRoles: UserRoles[];

  hashPassword() {
    if (hasValue(this.password)) {
      this.password = bcrypt.hashSync(this.password, hashCost);
    }
  }

  async validatePassword(unencryptedPassword: string): Promise<boolean> {
    return await bcrypt.compare(unencryptedPassword, this.password);
  }
}
