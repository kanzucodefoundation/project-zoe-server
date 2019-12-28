import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {EmailCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Email {

    @PrimaryGeneratedColumn()
    id: number

    @Column({
        type: "enum",
        enum: EmailCategory,
        nullable: false,
        default: EmailCategory.Personal
    })
    category: EmailCategory

    @Column()
    value: string

    @Column()
    isPrimary: boolean

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.emails, {nullable: false})
    contact: Contact
}
