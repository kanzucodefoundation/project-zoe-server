import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {GroupRole} from "./GroupRole";
import {Contact} from "../../crm/entities/contact";
import {Group} from "./Group";

@Entity()
export class GroupMember {
    @PrimaryGeneratedColumn()
    id: number;

    @JoinColumn()
    @ManyToOne(type => Group, it => it.groupMembers)
    group: Group;
    @Column()
    groupId: number;

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.groupMembers)
    contact: Contact;

    @Column()
    contactId: number;

    @Column({
        type: "enum",
        enum: GroupRole,
        nullable: true
    })
    role: GroupRole;
}
