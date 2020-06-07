import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UserTask {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	appointmentTaskId: number;

	@Column()
	userId: number;
}
