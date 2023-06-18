import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { User } from "src/users/entities/user.entity";

@Entity()
export class ReportSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "jsonb" })
  data: Record<string, any>;

  @Column({ type: "timestamp" })
  submittedAt: Date;

  @ManyToOne(() => User, (user) => user.reportSubmissions)
  user: User;
}
