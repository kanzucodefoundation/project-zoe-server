import {Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {Length} from "class-validator";
import {Group} from "./Group";

@Entity()
export class GroupCategory {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Length(1, 40)
    name: string;

    @Column()
    @Length(1, 200)
    details: string;

    @OneToMany(type => Group, it => it.category, {
        cascade: ["insert", "remove"]
    })
    groups: Group[];
}
