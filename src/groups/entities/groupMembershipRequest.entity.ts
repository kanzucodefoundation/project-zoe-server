import Contact from "src/crm/entities/contact.entity";
import { PrimaryGeneratedColumn, Column, Entity, JoinColumn, ManyToOne } from "typeorm";

@Entity()
export default class GroupMembershipRequest{
    @PrimaryGeneratedColumn()
    id: number;

    @JoinColumn()
    @ManyToOne(type => Contact, it => it.groupMembershipRequests)
    contact: Contact;

    @Column()
    contactId: number;

    @Column({ nullable: true })
    parentId?: number;

    @Column()
    closestCellGroupId: number;

    @Column()
    distanceKm: number;

}




