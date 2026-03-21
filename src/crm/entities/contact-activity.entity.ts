import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import Contact from './contact.entity';
import { User } from '../../users/entities/user.entity';
import { ContactActivityType } from '../enums/contact-activity-type.enum';

@Entity()
@Index(['tenant', 'contact', 'occurredAt'])
@Index(['tenant', 'type'])
export class ContactActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Contact, { nullable: false, onDelete: 'CASCADE' })
  contact: Contact;

  @Column({
    type: 'enum',
    enum: ContactActivityType,
    nullable: false,
  })
  type: ContactActivityType;

  // Human-readable description for display in the feed.
  // e.g. "Joined Naalya MC", "Completed call — no answer"
  @Column({ length: 300 })
  summary: string;

  @Column({ type: 'timestamp' })
  occurredAt: Date;

  // Optional back-reference to the source record.
  // Allows the frontend to deep-link if needed.
  @Column({ length: 50, nullable: true })
  referenceTable: string | null;

  @Column({ nullable: true })
  referenceId: number | null;

  // Who triggered this activity (staff member or system)
  @ManyToOne(() => User, { nullable: true })
  recordedBy: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
