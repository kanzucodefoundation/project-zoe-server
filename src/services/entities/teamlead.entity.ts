import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// import { MinistryCategories } from '../enums/ministryCategories';


@Entity()
export class Teamlead {
  @PrimaryGeneratedColumn()
  id: number;

  // @Column({
  //   type: 'enum',
  //   enum: MinistryCategories,
  //   nullable: true,
  // })
  // ministry: MinistryCategories;

  @Column({ length: 40 })
  taskname: string;

  @Column()
  startdate: Date;

  @Column()
  enddate: Date;

  @Column()
  taskinfo: string;

  @Column()
  volunteers: string;

}
