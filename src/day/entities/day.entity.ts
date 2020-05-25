import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';



@Entity()
export class Day {
  @PrimaryGeneratedColumn()
  id: number;

 

  @Column({ length: 40 })
  taskId: string;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @Column()
  task_info: string;

  @Column()
  assigned_to: string;

}
