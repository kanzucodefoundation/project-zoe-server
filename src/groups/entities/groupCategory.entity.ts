import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import Group from "./group.entity";

@Entity()
export default class GroupCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @OneToMany((type) => Group, (it) => it.category, {
    cascade: ["insert", "remove"],
  })
  groups: Group[];
}
