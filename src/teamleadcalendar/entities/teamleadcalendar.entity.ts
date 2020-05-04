import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';



@Entity()
export class Teamleadcalendar {
  @PrimaryGeneratedColumn()
  Id: number;


  @Column()
  startdate: Date;

  @Column()
  startDate: Date | string | number;

  @Column()
  endDate?: Date | string | number;

  @Column()
  title?: string;


  @Column()
  allDay?: boolean;
 
  @Column()
  id?: number | string;


  @Column()
  rRule?: string;


  @Column()
  exDate?: string;

  // @Column()
  // [propertyName: string]: any;


}
