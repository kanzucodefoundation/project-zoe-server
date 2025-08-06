import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import EventCategory from "./eventCategory.entity";

@Entity()
@Index(["name", "category"], { unique: true })
export default class EventField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40 })
  name: string;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 200, nullable: true })
  details?: string;

  @Column({ length: 25 })
  type: FieldType;

  @Column()
  isRequired: boolean;

  @ManyToOne(() => EventCategory, (it) => it.fields)
  @JoinColumn()
  category?: EventCategory;

  @Column({ nullable: true })
  order: number;
}

export enum FieldType {
  Text = "text",
  Number = "number",
  Date = "bate",
  Array = "array",
}
