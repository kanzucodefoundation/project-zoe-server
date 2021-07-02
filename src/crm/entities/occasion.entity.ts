import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';
import { OccasionCategory } from '../enums/occasionCategory';

@Entity()
export default class Occasion extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  value: Date;

  @Column()
  details: string;

  @Column({
    type: 'enum',
    enum: OccasionCategory,
    nullable: false,
    default: OccasionCategory.Birthday,
  })
  category: OccasionCategory;

  @JoinColumn()
  @ManyToOne((type) => Contact, (it) => it.occasions, {
    onDelete: 'CASCADE',
  })
  contact: Contact;

  @Column()
  contactId: number;
}
