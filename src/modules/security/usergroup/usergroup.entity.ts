import {Column, Entity, PrimaryGeneratedColumn, Unique} from "typeorm";
import {Length} from "class-validator";


export enum SystemRole {
    EDIT_USER = "EDIT_USER",
    VIEW_USER = "VIEW_USER",

    EDIT_USER_G = "EDIT_USER_G",
    VIEW_USER_G = "VIEW_USER_G",

    EDIT_CONTACT = "EDIT_CONTACT",
    VIEW_CONTACT = "VIEW_CONTACT",
}

@Entity()
@Unique(["name"])
export class UserGroup {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Length(4, 20)
    name: string;

    @Column()
    @Length(4, 100)
    details: string;

    @Column({
        type: "set",
        enum: SystemRole,
        default: [SystemRole.VIEW_CONTACT]
    })
    roles: SystemRole[]
}
