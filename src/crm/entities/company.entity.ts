import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';

@Entity()
export default class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToOne((type) => Contact, (it) => it.company, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  contact?: Contact;

  @Column()
  contactId: number;
}
