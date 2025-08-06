import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { ChatNode } from "./chat-node.entity";

@Entity()
export class ChatSession {
  @PrimaryGeneratedColumn({ name: "id" })
  id: number;

  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column()
  phone: string;

  @Column({ default: "" })
  userPath: string;

  @Column()
  language: string;

  @Column()
  isActive: boolean;

  @Column()
  sessionId: string;

  @OneToMany(() => ChatNode, (it) => it.session)
  nodes: ChatNode[];

  @Column("json", { default: {} })
  metaData: any;
}
