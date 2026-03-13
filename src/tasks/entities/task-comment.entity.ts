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
export class TaskComment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, (t) => t.comments, { onDelete: 'CASCADE' })
  task: Task;

  @ManyToOne(() => User, { nullable: false })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
