import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "src/users/entities/user.entity";
import { Report } from "./report.entity";
import { ReportSubmissionData } from "./report.submission.data.entity";

@Entity()
export class ReportSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  submittedAt: Date; //@TODO Add a key

  @ManyToOne(() => User, (user) => user.reportSubmissions)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Report, (report) => report.submissions)
  report: Report;

  @Column({ type: "jsonb" })
  data: Record<string, any>;

  @OneToMany(
    () => ReportSubmissionData,
    (reportSubmissionData) => reportSubmissionData.reportSubmission,
  )
  submissionData: ReportSubmissionData[];
}
