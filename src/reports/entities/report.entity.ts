import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

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
  fields: string[];

  @Column({ type: "jsonb", nullable: true })
  headers: string[];

  @Column({ type: "jsonb", nullable: true })
  footer: string[];

  // Additional properties for specific report types, like scatterplot
  @Column({ type: "jsonb", nullable: true })
  labels: string[];

  @Column({ type: "jsonb", nullable: true })
  dataPoints: number[];

  @Column({ type: "enum", enum: ["daily", "weekly", "monthly", "custom"] })
  submissionFrequency: "daily" | "weekly" | "monthly" | "custom";
}
