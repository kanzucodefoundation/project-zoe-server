import { Column, Entity, PrimaryColumn } from 'typeorm';
import { GroupCategoryReportFrequency } from '../enums/groupCategoryReportFrequency';

@Entity()
export class GroupCategoryReport {
  @PrimaryColumn()
  id: number;

  @Column({ length: 200 })
  groupCategoryId: string; // MC

  @Column({ length: 200 })
  eventCategoryId: string; // MC-Meeting

  @Column({
    type: 'enum',
    enum: GroupCategoryReportFrequency,
    nullable: true,
  })
  frequency: GroupCategoryReportFrequency;
}
