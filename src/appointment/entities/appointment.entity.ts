import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';




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
