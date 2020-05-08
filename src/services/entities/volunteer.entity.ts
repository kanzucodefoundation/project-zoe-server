import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MinistryCategories } from '../enums/ministryCategories';


@Entity()
export class Volunteer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: MinistryCategories,
    nullable: true,
  })
  ministry: MinistryCategories;

  @Column({ length: 40 })
  firstName: string;

  @Column({ length: 40 })
  surname: string;

  @Column()
  dateOfBirth: Date;

  @Column()
  missionalCommunity: string;

  @Column()
  profession: string;

}
