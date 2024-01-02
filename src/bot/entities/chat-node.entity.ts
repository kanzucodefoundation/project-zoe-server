import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { ChatAction } from "../dto/ussd-response.dto";
import { ChatSession } from "./chat-session.entity";

@Entity()
export class ChatNode {
  @PrimaryGeneratedColumn({ name: "id" })
  id: number;

  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column()
  name: string;

  @Column()
  hasError: boolean;

  @JoinColumn()
  @ManyToOne(() => ChatSession, (it) => it.nodes)
  session?: ChatSession;

  @Column()
  sessionId: number;

  @Column({ default: "" })
  userInput: string;

  @Column({
    type: "enum",
    enum: ChatAction,
    nullable: false,
    default: ChatAction.End,
  })
  nodeAction: ChatAction;

  @Column()
  message: string;

  @Column({ default: "" })
  nextHandler: string;

  toString(): string {
    return `ChatNode(name:${this.name}, input:${this.userInput})`;
  }
}
