import {Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique} from "typeorm";
import {Length} from "class-validator";
import * as bcrypt from "bcryptjs";
import {UserGroup} from "../usergroup/usergroup.entity";
import {Contact} from "../../crm/entities/contact";

@Entity()
@Unique(["username"])
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Length(4, 20)
    username: string;

    @Column()
    @Length(4, 100)
    password: string;

    @ManyToOne(type => UserGroup,{nullable:false})
    @JoinColumn()
    group: UserGroup;

    @OneToOne(type => Contact,{nullable:false})
    @JoinColumn()
    contact: Contact;

    hashPassword() {
        this.password = bcrypt.hashSync(this.password, 8);
    }

    checkIfUnencryptedPasswordIsValid(unencryptedPassword: string) {
        return bcrypt.compareSync(unencryptedPassword, this.password);
    }
}
