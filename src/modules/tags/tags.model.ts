import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../utils/schemaHelpers";
import {enumToArray} from "../../utils/enumHelpers";

export enum TagCategory {
    Group = "Group",
    Task = "Task",
    Person = "Person"
}

const schema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(TagCategory),
        default: TagCategory.Person
    },
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
});
configureId(schema);

export interface ITag extends Document {
    id?: string;
    category: TagCategory;
    name: string;
    color: any;
}


const TagModel = model<ITag>("Tag", schema);

export default TagModel;

export const createTagRules = [
    check("category", "category is required").not().isEmpty(),
    check("name", "name is required").not().isEmpty(),
    check("color", "color is required").not().isEmpty()
];

export const editTagRules = [
    check("id", "Id is required").not().isEmpty(),
    ...createTagRules
];
