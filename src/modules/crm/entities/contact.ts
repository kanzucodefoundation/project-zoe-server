import {Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn} from "typeorm";
import {Person} from "./person";
import {Company} from "./company";
import {Email} from "./email";
import {Phone} from "./phone";
import {Occasion} from "./occasion";
import {Address} from "./address";
import {Identification} from "./identification";
import {ContactCategory} from "./enums";

@Entity()
export class Contact {
    @PrimaryGeneratedColumn()
    id: number

    @Column({
        type: "enum",
        enum: ContactCategory,
        nullable: false,
        default: ContactCategory.Person
    })
    category: ContactCategory

    @OneToOne(type => Person)
    @JoinColumn()
    person?: Person

    @OneToOne(type => Person)
    @JoinColumn()
    company?: Company

    @OneToMany(type => Email, it => it.contact)
    emails: Email[]

    @OneToMany(type => Phone, it => it.contact)
    phones: Phone[]

    @OneToMany(type => Occasion, it => it.contact)
    occasions: Occasion[]

    @OneToMany(type => Address, it => it.contact)
    addresses: Address[]

    @OneToMany(type => Identification, it => it.contact)
    identifications: Identification[]
}
