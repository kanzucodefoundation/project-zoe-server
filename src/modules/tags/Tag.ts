import {Column, Entity, PrimaryGeneratedColumn, Unique} from "typeorm";
import {Length} from "class-validator";
import {EmailCategory} from "../crm/entities/enums";
export enum TagCategory {
    Group = "Group",
    Task = "Task",
    Person = "Person"
}


@Entity()
@Unique(["name"])
export class Tag {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Length(4, 20)
    name: string;

    @Column()
    @Length(4, 25)
    color: string;

    @Column({
        type: "enum",
        enum: TagCategory,
        nullable: false,
        default: TagCategory.Person
    })
    category: TagCategory;

    public static ref(id: number){
        const g = new Tag();
        g.id = id;
        return g;
    }
}
