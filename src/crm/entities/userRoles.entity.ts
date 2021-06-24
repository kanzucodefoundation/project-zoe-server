import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique(["roleName", "capabilities"])
export default class UserRoles {
    @PrimaryGeneratedColumn()
    id:number

    @Column({ nullable: false })
    roleName: string

    @Column('simple-array', { nullable: false })
    capabilities: string[]

    @Column({ nullable: false })
    isActive: Boolean
}