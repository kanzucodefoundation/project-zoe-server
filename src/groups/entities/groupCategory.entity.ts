import {Column, Entity, OneToMany, PrimaryColumn} from "typeorm";
import Group from './group.entity';
@Entity()
export default class GroupCategory {

  @PrimaryColumn({length:40})
  name: string;

  @Column({length:200})
  details: string;

  @OneToMany(type => Group, it => it.category, {
    cascade: ["insert", "remove"]
  })
  groups: Group[];
}
