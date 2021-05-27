import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';
import { PhoneCategory } from '../enums/phoneCategory';

@Entity()
export default class Phone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: PhoneCategory,
    nullable: false,
    default: PhoneCategory.Mobile,
  })
  category: PhoneCategory;

  @Column()
  value: string;

  @Column()
  isPrimary: boolean;

  @JoinColumn()
  @ManyToOne((type) => Contact, (it) => it.phones, {
    onDelete: 'CASCADE',
  })
  contact?: Contact;

  @Column()
  contactId: number;
}
