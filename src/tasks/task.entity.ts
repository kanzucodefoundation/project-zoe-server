import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MinistryCategories } from '../tasks/ministryCategories';
import { StatusCategories } from './tasks/statusCategories';


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

    @Column({
        type: 'enum',
        enum: StatusCategories,
        nullable: true,
    })
    status: StatusCategories;

    
}