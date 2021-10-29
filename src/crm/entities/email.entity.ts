import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';
import { EmailCategory } from '../enums/emailCategory';

@Entity()
export default class Email {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: EmailCategory,
    nullable: false,
    default: EmailCategory.Personal,
  })
  category: EmailCategory;

  @Column()
  value: string;

  @Column({
    default: false,
  })
  isPrimary: boolean;

  @JoinColumn()
  @ManyToOne((type) => Contact, (it) => it.emails, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  contact?: Contact;

  @Column()
  contactId: number;
}
