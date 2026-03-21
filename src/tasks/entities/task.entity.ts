import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import Contact from '../../crm/entities/contact.entity';
import { User } from '../../users/entities/user.entity';
import { TaskComment } from './task-comment.entity';
import { TaskAttachment } from './task-attachment.entity';
import { TaskType } from '../enums/task-type.enum';
import { TaskStatus } from '../enums/task-status.enum';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'contact'])
@Index(['tenant', 'status'])
@Index(['tenant', 'assignedTo'])
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Contact, { nullable: false, onDelete: 'CASCADE' })
  contact: Contact;

  @Column({
    type: 'enum',
    enum: TaskType,
    nullable: false,
  })
  type: TaskType;

  @Column({ length: 200, nullable: true })
  title: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @ManyToOne(() => User, { nullable: true })
  assignedTo: User | null;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => TaskComment, (c) => c.task, { cascade: true })
  comments: TaskComment[];

  @OneToMany(() => TaskAttachment, (a) => a.task, { cascade: true })
  attachments: TaskAttachment[];

  @CreateDateColumn()
  createdAt: Date;
}
