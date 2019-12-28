import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {PhoneCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Phone {
    @PrimaryGeneratedColumn()
    id: number

    @Column({
        type: "enum",
        enum: PhoneCategory,
        nullable: false,
        default: PhoneCategory.Mobile
    })
    category: PhoneCategory

    @Column()
    value: string

    @Column()
    isPrimary: boolean

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.phones, {nullable: false})
    contact: Contact
}
