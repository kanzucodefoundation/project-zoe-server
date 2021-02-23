import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true, length: 500 })
  details?: string;
}
