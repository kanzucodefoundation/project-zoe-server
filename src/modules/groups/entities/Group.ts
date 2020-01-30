import {Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {Length} from "class-validator";
import {GroupPrivacy} from "./GroupPrivacy";
import {GroupCategory} from "./GroupCategory";
import {GroupMember} from "./GroupMember";

@Entity()
export class Group {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: "enum",
        enum: GroupPrivacy,
        nullable: true
    })
    privacy: GroupPrivacy;

    @Column()
    @Length(1, 40)
    name: string;

    @Column()
    @Length(1, 200)
    details: string;

    @ManyToOne(type => GroupCategory, it => it.groups)
    category: GroupCategory;

    @ManyToOne(type => Group, it => it.children)
    parent: Group;

    @OneToMany(type => Group, it => it.parent)
    children: Group[];


    @JoinColumn()
    @OneToMany(type => GroupMember, it => it.group)
    groupMembers: GroupMember[];
}
