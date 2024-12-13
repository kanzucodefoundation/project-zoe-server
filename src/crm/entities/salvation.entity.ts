import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("salvation_records")
export class SalvationRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  fullName: string;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  email?: string;

  @Column()
  address: string;

  @Column({ type: "timestamp" })
  dateOfSalvation: Date;

  @Column()
  serviceOrEvent: string;

  @CreateDateColumn()
  createdAt: Date;
}
