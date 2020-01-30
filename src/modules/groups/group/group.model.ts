import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaHelpers";
import {enumToArray} from "../../../utils/enumHelpers";

export enum GroupPrivacy {
    Private = "Private",
    Public = "Public"
}

const schema = new Schema({
    name: {
        type: String,
        index: true,
        unique: true,
        required: true,
    },
    details: {
        type: String,
        required: true
    },
    privacy: {
        type: String,
        required: true,
        enum: enumToArray(GroupPrivacy),
        default: GroupPrivacy.Public
    },
    category: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'GroupCategory'
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: 'Group'
    }
});
configureId(schema)

export interface IGroup extends Document {
    id?: string
    name: string
    privacy: GroupPrivacy
    details?: string
    category: any
    parent: any | null
}

const GroupModel = model<IGroup>('Group', schema);

export default GroupModel

export const createGroupRules = [
    check("name", "name is required").not().isEmpty(),
    check("category", "category is required").not().isEmpty(),
    check("privacy", "privacy is required").not().isEmpty()
]

export const editGroupRules = [
    check("id", "id is required").not().isEmpty(),
    ...createGroupRules
]
