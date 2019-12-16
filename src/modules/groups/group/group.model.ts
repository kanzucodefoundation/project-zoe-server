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
    description: {
        type: String,
        required: true
    },
    tag: {
        type: String,
        required: true
    },
    privacy: {
        type: String,
        required: true,
        enum: enumToArray(GroupPrivacy),
        default: GroupPrivacy.Public
    },
    parent: String
});
configureId(schema)

export interface IGroup extends Document {
    id?: string
    name: string
    tag: string
    privacy: GroupPrivacy
    description?: string
    parent: any | null
}


const GroupModel = model<IGroup>('Group', schema);

export default GroupModel

export const createGroupRules = [
    check("name", "name cannot be blank").not().isEmpty(),
    check("tag", "tag cannot be blank").not().isEmpty(),
    check("privacy", "privacy cannot be blank").not().isEmpty()
]

export const editGroupRules = [
    check("id", "Id is required").not().isEmpty(),
    check("name", "name cannot be blank").not().isEmpty(),
    check("tag", "tag cannot be blank").not().isEmpty(),
    check("privacy", "privacy cannot be blank").not().isEmpty()
]

export class GroupDto {
    id?: string
    name: string
    tag: string
    privacy: GroupPrivacy
    description?: string
    parent: any | null

    static create({id, name, tag, privacy, description, parent}: any): GroupDto {
        return {id, name, tag, privacy, description, parent}
    }
}


