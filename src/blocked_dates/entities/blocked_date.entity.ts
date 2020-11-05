import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
// import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
// import Person from 'src/crm/entities/person.entity'

@Entity()
export class BlockedDate {
	@PrimaryGeneratedColumn()
	id: number;

	
	@Column()
  	startDate: Date;

	@Column()
	endDate: Date;

	// @Column()
	// userId: number;

  	@Column({ length: 40 })
  	reason: string;

  	
	// @ManyToOne(
	// 	type => AppointmentTask,
	// 	userTask => userTask.appointmentId,
	// 	)
	// 	userTask: AppointmentTask;

	// 	@JoinColumn()
	// 	appointmentTask: AppointmentTask;
};

