import { CivilStatus } from "src/crm/enums/civilStatus";
import { Gender } from "src/crm/enums/gender";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { WHLocation } from "../enums/whLocation";


@Entity({name:'visitors'})
export class Visitor{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({ length: 50 })
    firstName: string;
  
    @Column({ length: 50 })
    lastName: string;
  
    @Column({ nullable: true, length: 50 })
    otherNames: string;
  
    @Column({
    type: 'enum',
    enum: Gender,
    nullable: false,
    })
    gender: Gender;

    @Column({ length: 50 })
    phone: string;

    @Column({ length:50 })
    residence: string;
  
    @Column({ nullable: true })
    placeOfWork: string;

    @Column({length:50, unique:true, nullable: true})
    email:string;

    @Column({
    type: 'enum',
    enum: CivilStatus,
    nullable: true,
    })
    civilStatus: CivilStatus;

    @Column({
    type: 'enum',
    enum: WHLocation,
    })
    whLocation: WHLocation;

    @CreateDateColumn()
    createdOn?: Date;

    @CreateDateColumn()
    updatedOn?: Date;

}