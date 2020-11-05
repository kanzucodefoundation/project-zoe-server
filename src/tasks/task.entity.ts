import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { MinistryCategories } from '../tasks/ministryCategories';
import { AppointmentTask } from 'src/appointment_tasks/entities/appointment_task.entity';
import { StatusCategories } from '../tasks/statusCategories';


@Entity()
export class Task {
    [x: string]: any;
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'enum',
        enum: MinistryCategories,
        nullable: true,
    })
    ministry: MinistryCategories;

    @Column({ length: 40 })
    taskName: string;

    @Column({ length: 40 })
    taskDescription: string;

    @OneToMany(
        type => AppointmentTask,
        appointmentTask => appointmentTask.task,
        )
    appointments: AppointmentTask[];

    @Column({
        type: 'enum',
        enum: StatusCategories,
        nullable: true,
    })
    status: StatusCategories;

    
}