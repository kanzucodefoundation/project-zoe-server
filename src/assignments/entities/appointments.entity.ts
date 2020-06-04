import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// import  Person  from '../../crm/entities/person.entity'



@Entity()
export class Appointments {
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
