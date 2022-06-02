import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity()
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string; //@TODO Make it unique
}
