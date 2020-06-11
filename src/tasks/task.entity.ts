import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { MinistryCategories } from '../tasks/ministryCategories';
import { Appointment } from 'src/appointment/entities/appointment.entity';


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
        type => Appointment,
        appointment => appointment.task,
        )
    appointments: Appointment[];
    
}