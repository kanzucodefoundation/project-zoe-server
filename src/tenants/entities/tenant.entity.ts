import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'varchar', unique: true, length: 100 })
  name: string;
  @Column({ type: 'text', nullable: true })
  description: string;
}
