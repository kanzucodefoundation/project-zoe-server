import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { Task } from 'src/tasks/task.entity';
// import  Person  from '../../crm/entities/person.entity'



@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number; 
  

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column()
  taskInfo: string;

  @ManyToOne(
    type => Task,
    task => task.appointments,
    )
  task: Task;

}
