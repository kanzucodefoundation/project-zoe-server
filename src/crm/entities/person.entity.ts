import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Salutation } from '../enums/salutation';
import Contact from './contact.entity';

import { Gender } from '../enums/gender';
import { CivilStatus } from '../enums/civilStatus';

@Entity()
export default class Person {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({
    type: 'enum',
    enum: Salutation,
    nullable: true,
  })
  salutation: Salutation;

  @Column({ length: 40 })
  firstName: string;

  @Column({ length: 40 })
  lastName: string;

  @Column({ nullable: true, length: 40 })
  middleName: string;

  @Column({ nullable: true })
  ageGroup: string;

  @Column({ nullable: true })
  placeOfWork: string;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: false,
  })
  gender: Gender;

  @Column({
    type: 'enum',
    enum: CivilStatus,
    nullable: true,
  })
  civilStatus: CivilStatus;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @OneToOne((type) => Contact, (it) => it.person, {
    cascade: ['insert', 'remove', 'update'],
  })
  @JoinColumn()
  contact: Contact;

  @Column()
  contactId: number;
}
