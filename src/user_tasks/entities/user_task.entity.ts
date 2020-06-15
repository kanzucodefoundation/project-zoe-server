import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';

@Entity()
export class UserTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentTaskId: number;

	@Column()
	userId: number;

	@OneToMany(
        type => AppointmentTask,
        appointmentTask => appointmentTask.task,
        )
    appointments: AppointmentTask[];
}
