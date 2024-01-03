import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Report } from "./report.entity";

export enum FieldType {
  TEXT = "text",
  NUMBER = "number",
  DATE = "date",
  DATETIME = "datetime",
  SELECT = "select",
}

@Entity()
export class ReportField {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Report, (report) => report.fields)
  report: Report;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: FieldType,
    default: FieldType.TEXT,
  })
  type: FieldType;

  @Column()
  label: string; // User-friendly label for the field

  @Column({ default: false })
  required: boolean; // Whether the field is required or not

  @Column({ type: "jsonb", nullable: true })
  options: any[]; // For fields like 'select', to store possible options
}
