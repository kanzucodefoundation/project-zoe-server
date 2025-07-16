import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "src/users/entities/user.entity";
import { Report } from "./report.entity";
import { ReportSubmissionData } from "./report.submission.data.entity";
import Group from "src/groups/entities/group.entity";

@Entity()
@Index(["submittedAt"])
export class ReportSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  submittedAt: Date;

  @ManyToOne(() => User, (user) => user.reportSubmissions)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Report, (report) => report.submissions)
  report: Report;

  @ManyToOne(() => Group, (group) => group.reportSubmissions, {
    onDelete: "SET NULL",
    nullable: true,
  })
  group: Group;

  @Column({ type: "jsonb", nullable: true })
  data: Record<string, any>;

  @OneToMany(
    () => ReportSubmissionData,
    (reportSubmissionData) => reportSubmissionData.reportSubmission,
  )
  submissionData: ReportSubmissionData[];
}
