import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import * as bcrypt from 'bcrypt';
import Contact from '../crm/entities/contact.entity';
import { hasValue } from '../utils/basicHelpers';

// authentication will take approximately 13 seconds
// https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
const hashCost = 10;

@Entity()
@Unique(["username"])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length:40 })
  username: string;

  @Column({ length: 100 })
  password: string;

  @OneToOne(type => Contact,{nullable:false})
  @JoinColumn()
  contact: Contact;

  hashPassword() {
    if(hasValue(this.password)){
      this.password = bcrypt.hashSync(this.password, hashCost);
    }
  }

  async validatePassword(unencryptedPassword: string):Promise<boolean> {
    return await bcrypt.compare(unencryptedPassword, this.password);
  }
}
