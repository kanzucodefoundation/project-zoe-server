import { MemberEventActivities } from '../../events/entities/member-event-activities.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Person from './person.entity';
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
import GroupMembershipRequest from '../../groups/entities/groupMembershipRequest.entity';
import EventAttendance from '../../events/entities/eventAttendance.entity';
import EventRegistration from 'src/events/entities/eventRegistration.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
@Index(['tenant', 'id'])
export default class Contact {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.contacts, { nullable: false })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: ContactCategory,
    nullable: false,
    default: ContactCategory.Person,
  })
  category: ContactCategory;

  @OneToOne((type) => Person, (it) => it.contact, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  person?: Person;

  @OneToOne((type) => Person, (it) => it.contact, { cascade: true })
  company?: Company;

  @OneToMany((type) => Email, (it) => it.contact, { cascade: true })
  emails: Email[];

  @OneToMany((type) => Phone, (it) => it.contact, { cascade: true })
  phones: Phone[];

  @OneToMany((type) => Occasion, (it) => it.contact, { cascade: true })
  occasions: Occasion[];

  @OneToMany((type) => Address, (it) => it.contact, { cascade: true })
  addresses: Address[];

  @OneToMany((type) => Identification, (it) => it.contact, { cascade: true })
  identifications: Identification[];

  @OneToMany((type) => Relationship, (it) => it.contact, { cascade: true })
  relationships: Relationship[];

  @OneToMany((type) => Request, (it) => it.contact, { cascade: true })
  requests: Request[];

  @JoinColumn()
  @OneToMany((type) => GroupMembership, (it) => it.contact, {
    cascade: ['insert'],
  })
  groupMemberships: GroupMembership[];

  @JoinColumn()
  @OneToMany((type) => GroupMembershipRequest, (it) => it.contact, {
    cascade: ['insert'],
  })
  groupMembershipRequests: GroupMembershipRequest[];

  @OneToMany((type) => EventAttendance, (it) => it.contact, {
    cascade: ['insert'],
  })
  attendance: EventAttendance[];

  @OneToMany((type) => MemberEventActivities, (it) => it.contact)
  member: MemberEventActivities[];

  @OneToMany((type) => EventRegistration, (it) => it.contact, {
    cascade: ['insert'],
  })
  registration: EventRegistration[];

  static ref(id: number) {
    const c = new Contact();
    c.id = id;
    return c;
  }
}
