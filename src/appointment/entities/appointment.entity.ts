import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// import  Person  from '../../crm/entities/person.entity'



@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number; 
  

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column()
  taskInfo: string;

  

}
