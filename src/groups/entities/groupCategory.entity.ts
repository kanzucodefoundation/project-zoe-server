import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import Group from "./group.entity";
import { Tenant } from "../../tenants/entities/tenant.entity";

@Entity()
export default class GroupCategory {
  @Column()
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column({ nullable: false })
  tenantId: number;

  @OneToMany((type) => Group, (it) => it.category, {
    cascade: ["insert", "remove"],
  })
  groups: Group[];
}
