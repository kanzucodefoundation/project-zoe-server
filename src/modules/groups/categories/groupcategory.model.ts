import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaHelpers";

const schema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    details: {
        type: String,
        required: true
    }
});
configureId(schema)

export interface IGroupCategory extends Document {
    id?: string
    name: string
    details: string
}

const GroupCategoryModel = model<IGroupCategory>('GroupCategory', schema);

export default GroupCategoryModel

export const createGroupCategoryRules = [
    check("name", "group is required").not().isEmpty(),
    check("details", "contact is required").not().isEmpty()
]

export const editGroupCategoryRules = [
    check("id", "id is required").not().isEmpty(),
    ...createGroupCategoryRules
]
