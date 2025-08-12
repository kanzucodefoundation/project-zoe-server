import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from "typeorm";
import { ReportSubmission } from "./report.submission.entity";
import { User } from "src/users/entities/user.entity";
import { ReportField } from "./report.field.entity";
import GroupCategory from "src/groups/entities/groupCategory.entity";
import { ReportStatus } from "../enums/report.enum";

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ nullable: true })
  functionName: string | null;

  @Column({
    type: "enum",
    default: "table",
    enum: [
      "table",
      "piechart",
      "bargraph",
      "linechart",
      "scatterplot",
      "heatmap",
      "gaugechart",
      "treemap",
      "donutchart",
    ],
  })
  viewType:
    | "table"
    | "piechart"
    | "bargraph"
    | "linechart"
    | "scatterplot"
    | "heatmap"
    | "gaugechart"
    | "treemap"
    | "donutchart";

  @Column({ type: "text", nullable: true })
  sqlQuery: string;

  @OneToMany(() => ReportField, (field) => field.report, {
    cascade: true,
  })
  fields: ReportField[];

  @Column({ type: "jsonb", nullable: true })
  displayColumns: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  footer: string[];

  // Additional properties for specific report types, like scatterplot
  @Column({ type: "jsonb", nullable: true })
  labels: string[];

  @Column({ type: "jsonb", nullable: true })
  dataPoints: number[];

  @Column({ type: "enum", enum: ["daily", "weekly", "monthly", "custom"] })
  submissionFrequency: "daily" | "weekly" | "monthly" | "custom";

  @OneToMany(() => ReportSubmission, (submission) => submission.report)
  submissions: ReportSubmission[];

  @ManyToOne(() => GroupCategory, { nullable: true })
  targetGroupCategory?: GroupCategory;

  @ManyToOne(() => User, (user) => user.reports)
  user: User;

  @Column({ default: true })
  active: boolean;

  @Index()
  @Column({
    type: "enum",
    enum: ReportStatus,
    default: ReportStatus.DRAFT /* choose what fits your workflow */,
  })
  status: ReportStatus;
}
