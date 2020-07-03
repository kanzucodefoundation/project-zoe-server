import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity()
export class AppointmentTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentId: number;

	@Column()
	taskId: number;
	
}
