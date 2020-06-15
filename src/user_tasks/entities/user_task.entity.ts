import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';

@Entity()
export class UserTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentTaskId: number;

	@Column()
	userId: number;

	@ManyToOne(
		type => AppointmentTask,
		userTask => userTask.appointmentId,
		)
		userTask: AppointmentTask;

		@JoinColumn()
		appointmentTask: AppointmentTask;
}
