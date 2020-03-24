import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GroupPrivacy } from '../enums/groupPrivacy';
import GroupCategory from './groupCategory.entity';
import GroupMembership from './groupMembership.entity';

@Entity()
export default class Group {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: GroupPrivacy,
    nullable: true
  })
  privacy: GroupPrivacy;

  @Column({ length: 50 })
  name: string;

  @Column({nullable: true,length:200})
  details?: string;

  @ManyToOne(type => GroupCategory, it => it.groups)
  category?: GroupCategory;

  @Column()
  categoryId: string;

  @ManyToOne(type => Group, it => it.children)
  parent?: Group;
  @Column({nullable: true})
  parentId?: number;

  @OneToMany(type => Group, it => it.parent)
  children: Group[];

  @JoinColumn()
  @OneToMany(type => GroupMembership, it => it.group)
  members: GroupMembership[];
}
