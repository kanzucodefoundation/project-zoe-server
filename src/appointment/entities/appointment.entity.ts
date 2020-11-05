import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';




@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number; 
  

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  // @Column()
  // taskDescription: string;

  // @OneToMany(
  //   type => AppointmentTask,
  //   appointmentTask => appointmentTask.appointment,
  //   )
  // appointmentTasks: AppointmentTask[];

}
