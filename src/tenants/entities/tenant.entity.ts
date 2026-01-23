import { ChatSession } from 'src/bot/entities/chat-session.entity';
import Contact from 'src/crm/entities/contact.entity';
import EventCategory from 'src/events/entities/eventCategory.entity';
import Group from 'src/groups/entities/group.entity';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import Help from 'src/help/entities/help.entity';
import Roles from 'src/users/entities/roles.entity';
import { Report } from 'src/reports/entities/report.entity';
import { User } from 'src/users/entities/user.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true, length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Contact, (contact) => contact.tenant)
  contacts: Contact[];

  @OneToMany(() => Group, (group) => group.tenant)
  groups: Group[];

  @OneToMany(() => GroupCategory, (groupCategory) => groupCategory.tenant)
  groupCategories: GroupCategory[];

  @OneToMany(() => EventCategory, (eventCategory) => eventCategory.tenant)
  eventCategories: EventCategory[];

  @OneToMany(() => Roles, (role) => role.tenant)
  roles: Roles[];

  @OneToMany(() => Help, (help) => help.tenant)
  helpArticles: Help[];

  @OneToMany(() => ChatSession, (chatSession) => chatSession.tenant)
  chatSessions: ChatSession[];

  @OneToMany(() => Report, (report) => report.tenant)
  reports: Report[];
}
