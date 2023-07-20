import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { ReportSubmission } from "./report.submission.entity";
import { User } from "src/users/entities/user.entity";
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
  type:
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

  @Column({ type: "jsonb", nullable: true })
  fields: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  columns: Record<string, any>;

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

  @ManyToOne(() => User, (user) => user.reports)
  user: User;
}
