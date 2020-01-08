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
    @PrimaryGeneratedColumn({name: 'id'})
    id: number

    @Column({
        type: "enum",
        enum: ContactCategory,
        nullable: false,
        default: ContactCategory.Person
    })
    category: ContactCategory

    @OneToOne(type => Person, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    @JoinColumn()
    person?: Person

    @OneToOne(type => Person)
    @JoinColumn()
    company?: Company

    @OneToMany(type => Email, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    emails: Email[]

    @OneToMany(type => Phone, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    phones: Phone[]

    @OneToMany(type => Occasion, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    occasions: Occasion[]

    @OneToMany(type => Address, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    addresses: Address[]

    @OneToMany(type => Identification, it => it.contact, {
        cascade: ["insert", "remove"]
    })
    identifications: Identification[]

    static ref(id: any) {
        const c = new Contact()
        c.id = id
        return c
    }
}
