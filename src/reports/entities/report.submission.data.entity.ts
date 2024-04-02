import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { ReportSubmission } from "./report.submission.entity";
import { ReportField } from "./report.field.entity";

@Entity()
export class ReportSubmissionData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ReportSubmission)
  reportSubmission: ReportSubmission;

  @ManyToOne(() => ReportField)
  reportField: ReportField;

  @Column()
  fieldValue: string;
}
