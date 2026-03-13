import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class TaskAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, (t) => t.attachments, { onDelete: 'CASCADE' })
  task: Task;

  @ManyToOne(() => User, { nullable: true })
  uploadedBy: User | null;

  @Column()
  url: string;

  @Column({ length: 100, nullable: true })
  label: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
