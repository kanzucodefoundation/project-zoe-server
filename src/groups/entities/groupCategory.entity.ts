import { BaseEntity, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import Group from './group.entity';

@Entity()
export default class GroupCategory extends BaseEntity {
  @PrimaryColumn({ length: 40 })
  id: string;

  @Column({ length: 200 })
  name: string;

  @OneToMany((type) => Group, (it) => it.category, {
    cascade: ['insert', 'remove'],
  })
  groups: Group[];
}
