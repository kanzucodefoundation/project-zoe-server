import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Contact from './contact.entity';
import { AddressCategory } from '../enums/addressCategory';

@Entity()
export default class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AddressCategory,
    nullable: false,
    default: AddressCategory.Home,
  })
  category: AddressCategory;

  @Column()
  isPrimary: boolean;

  @Column()
  country: string;

  @Column()
  district: string;

  @Column({ nullable: true })
  freeForm?: string;

  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'point', nullable: true })
  geoCoordinates?: string;

  @Column({ nullable: true })
  placeId?: string;

  @JoinColumn()
  @ManyToOne(
    type => Contact,
    it => it.addresses,
    { nullable: false, cascade: ['insert', 'remove'] },
  )
  contact: Contact;
  @Column()
  contactId: number;
}
