import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
import Person from 'src/crm/entities/person.entity'

@Entity()
export class UserTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentTaskId: number;

	// @Column()
	// userId: number;

	@ManyToOne(type => Person, person => person.id)
  	userId: Person[];

	// @ManyToOne(
	// 	type => AppointmentTask,
	// 	userTask => userTask.appointmentId,
	// 	)
	// 	userTask: AppointmentTask;

	// 	@JoinColumn()
	// 	appointmentTask: AppointmentTask;
}
