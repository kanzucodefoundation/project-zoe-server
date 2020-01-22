import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {IdentificationCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Identification {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    value: string

    @Column()
    cardNumber?: string

    @Column()
    issuingCountry: string

    @Column()
    startDate: Date

    @Column()
    expiryDate: Date

    @Column({
        type: "enum",
        enum: IdentificationCategory,
        nullable: false,
        default: IdentificationCategory.Nin
    })
    category: IdentificationCategory

    @Column()
    isPrimary: boolean

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.identifications, {nullable: false})
    contact: Contact
}
