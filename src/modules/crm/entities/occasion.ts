import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {OccasionCategory} from "./enums";
import {Contact} from "./contact";

@Entity()
export class Occasion {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    value: Date

    @Column()
    details: string

    @Column({
        type: "enum",
        enum: OccasionCategory,
        nullable: false,
        default: OccasionCategory.Birthday
    })
    category: OccasionCategory

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.occasions, {nullable: false})
    contact: Contact
}
