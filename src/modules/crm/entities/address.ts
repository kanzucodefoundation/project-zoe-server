import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {AddressCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Address {
    @PrimaryGeneratedColumn()
    id: number

    @Column({
        type: "enum",
        enum: AddressCategory,
        nullable: false,
        default: AddressCategory.Home
    })
    category: AddressCategory

    @Column()
    isPrimary: boolean

    @Column()
    country: string

    @Column()
    district: string

    @Column()
    county: string

    @Column()
    subCounty?: string

    @Column()
    village?: string

    @Column()
    parish?: string

    @Column()
    postalCode?: string

    @Column()
    street?: string

    @Column()
    freeForm?: string

    @Column()
    latLon?: string

    @Column()
    placeId?: string

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.addresses, {nullable: false})
    contact: Contact
}
