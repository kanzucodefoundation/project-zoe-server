import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Task } from 'src/tasks/task.entity';
import { Appointment } from 'src/appointment/entities/appointment.entity';
import { UserTask } from 'src/user_tasks/entities/user_task.entity';

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

	@OneToMany(
		type => UserTask,
		userTask => userTask.appointmentTaskId,
	)
	userTasks: UserTask[];


	// @ManyToOne(
	// type => Appointment,
	// appointment => appointment.appointmentTasks,
	// )
	// appointment: Appointment;

}