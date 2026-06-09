import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Report } from './report.entity';
import { ReportSubmissionData } from './report.submission.data.entity';
import Group from 'src/groups/entities/group.entity';

@Entity()
@Index(['submittedAt'])
export class ReportSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({ type: 'date', nullable: true })
  reportingPeriod?: string;

  @ManyToOne(() => User, (user) => user.reportSubmissions)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Report, (report) => report.submissions)
  report: Report;

  @ManyToOne(() => Group, (group) => group.reportSubmissions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  group: Group;

  @OneToMany(
    () => ReportSubmissionData,
    (reportSubmissionData) => reportSubmissionData.reportSubmission,
  )
  submissionData: ReportSubmissionData[];
}
