import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatNode } from './chat-node.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
@Index(['tenant', 'id'])
export class ChatSession {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.chatSessions, { nullable: false })
  tenant: Tenant;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column()
  phone: string;

  @Column({ default: '' })
  userPath: string;

  @Column()
  language: string;

  @Column()
  isActive: boolean;

  @Column()
  sessionId: string;

  @OneToMany(() => ChatNode, (it) => it.session)
  nodes: ChatNode[];

  @Column('json', { default: {} })
  metaData: any;
}
