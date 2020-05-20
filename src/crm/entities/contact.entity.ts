import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import Person from './person.entity';
import { User } from '../../users/user.entity';
import Company from './company.entity';
import Email from './email.entity';
import Request from './request.entity';
import Phone from './phone.entity';
import Occasion from './occasion.entity';
import Address from './address.entity';
import Identification from './identification.entity';
import { ContactCategory } from '../enums/contactCategory';
import GroupMembership from '../../groups/entities/groupMembership.entity';
import Relationship from './relationship.entity';


@Entity()
export default class Contact {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({
    type: 'enum',
    enum: ContactCategory,
    nullable: false,
    default: ContactCategory.Person,
  })
  category: ContactCategory;

  @OneToOne(type => Person, it => it.contact)
  person?: Person;

  @OneToOne(type => User, it => it.contact)
  user?: User;

  @OneToOne(type => Person, it => it.contact)
  company?: Company;

  @OneToMany(type => Email, it => it.contact)
  emails: Email[];

  @OneToMany(type => Phone, it => it.contact)
  phones: Phone[];

  @OneToMany(type => Occasion, it => it.contact)
  occasions: Occasion[];

  @OneToMany(type => Address, it => it.contact)
  addresses: Address[];

  @OneToMany(type => Identification, it => it.contact)
  identifications: Identification[];

  @OneToMany(type => Relationship, it => it.contact)
  relationships: Relationship[];

  @OneToMany(type => Request, it => it.contact)
  requests: Request[];

  @JoinColumn()
  @OneToMany(type => GroupMembership, it => it.contact)
  groupMemberships: GroupMembership[];

  static ref(id: number) {
    const c = new Contact();
    c.id = id;
    return c;
  }
}
