import {Column, Entity, PrimaryGeneratedColumn, OneToOne, OneToMany} from "typeorm";
import {Length} from "class-validator";
import {CivilStatus, Gender, Salutation} from "./enums";
import {Contact} from "./contact";
import {Group} from "../../groups/entities/Group";

@Entity()
export class Person {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: "enum",
        enum: Salutation,
        nullable: true
    })
    salutation: Salutation;

    @Column()
    @Length(4, 40)
    firstName: string;

    @Column()
    @Length(4, 40)
    lastName: string;

    @Column({nullable: true})
    @Length(4, 40)
    middleName: string;

    @Column({nullable: true})
    ageGroup: string;

    @Column({nullable: true})
    placeOfWork: string;

    @Column({
        type: "enum",
        enum: Gender,
        nullable: false
    })
    gender: Gender;

    @Column({
        type: "enum",
        enum: CivilStatus,
        nullable: true
    })
    civilStatus: CivilStatus;

    @Column({nullable: true})
    avatar: string;

    @Column()
    dateOfBirth: Date;

    @OneToOne(type => Contact, it => it.person)
    contact: Contact;

    contactId: number;

    @Column({nullable: true})
    cellGroupId: number;

    @Column({nullable: true})
    churchLocationId: number;
}
