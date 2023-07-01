import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
} from "typeorm";
import { GroupPrivacy } from "../enums/groupPrivacy";
import GroupCategory from "./groupCategory.entity";
import GroupMembership from "./groupMembership.entity";
import GroupMembershipRequest from "./groupMembershipRequest.entity";
import GroupEvent from "../../events/entities/event.entity";
import InternalAddress from "../../shared/entity/InternalAddress";

@Entity()
@Tree("closure-table")
export default class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: GroupPrivacy,
    nullable: true,
  })
  privacy: GroupPrivacy;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true, length: 500 })
  details?: string;

  @Column({
    nullable: true,
    type: "jsonb",
  })
  metaData?: any;

  @ManyToOne(() => GroupCategory, (it) => it.groups)
  category?: GroupCategory;

  @TreeChildren()
  children: Group[];

  @TreeParent()
  parent: Group;

  @Column({ nullable: true })
  parentId?: number;

  @Column({
    nullable: true,
    type: "jsonb",
  })
  address?: InternalAddress;

  @OneToMany((type) => GroupEvent, (it) => it.group)
  events: GroupEvent[];

  @JoinColumn()
  @OneToMany((type) => GroupMembership, (it) => it.group)
  members: GroupMembership[];

  @JoinColumn()
  @OneToMany((type) => GroupMembershipRequest, (it) => it.group)
  groupMembershipRequests: GroupMembershipRequest[];
}
