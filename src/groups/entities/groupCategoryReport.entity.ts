import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GroupCategoryReportFrequency } from "../enums/groupCategoryReportFrequency ";
import GroupCategory from "./groupCategory.entity";

@Entity()
export default class GroupCategoryReport {
  @Column()
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => GroupCategory, (it) => it.id)
  @JoinColumn()
  groupCategory: GroupCategory;

  @Column({ nullable: true })
  groupCategoryId: string;

  @Column({ nullable: true })
  eventCategoryId: string;

  @Column({
    type: "enum",
    enum: GroupCategoryReportFrequency,
    nullable: true,
  })
  frequency: GroupCategoryReportFrequency;
}
