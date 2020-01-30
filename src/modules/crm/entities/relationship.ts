import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {RelationshipCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Relationship {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: "enum",
        enum: RelationshipCategory,
        nullable: false,
        default: RelationshipCategory.Other
    })
    category: RelationshipCategory;

    @JoinColumn()
    @ManyToOne(type => Contact)
    contact?: Contact;

    @JoinColumn()
    @ManyToOne(type => Contact, )
    other?: Contact
}
