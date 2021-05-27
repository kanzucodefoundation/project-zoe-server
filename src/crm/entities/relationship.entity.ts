import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';
import { RelationshipCategory } from '../enums/relationshipCategory';

@Entity()
export default class Relationship {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: RelationshipCategory,
    nullable: false,
    default: RelationshipCategory.Other,
  })
  category: RelationshipCategory;

  @JoinColumn()
  @ManyToOne((type) => Contact, {
    onDelete: 'CASCADE',
  })
  contact: Contact;
  @Column()
  contactId: number;

  @JoinColumn()
  @ManyToOne((type) => Contact)
  relative: Contact;
  @Column()
  relativeId: number;
}
