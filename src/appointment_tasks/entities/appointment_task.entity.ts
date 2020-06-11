import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { Task } from 'src/tasks/task.entity';

@Entity()
export class AppointmentTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentId: number;

	@Column()
	taskId: number;

	 @ManyToOne(
    type => Task,
    task => task.appointments,
    )
  task: Task;
	
}
