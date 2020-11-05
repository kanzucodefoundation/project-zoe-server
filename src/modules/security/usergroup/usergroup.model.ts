import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaHelpers";

const schema = new Schema({
    name: {
        type: String,
        index: true,
        unique: true,
        required: true
    },
    roles: [String],
    details: {
        type: String,
        required: true
    }
}, {});

configureId(schema)

export interface IUserGroup extends Document {
    name: string
    details: string
    roles: string[]
}

const UserGroupModel = model<IUserGroup>('UserGroup', schema);

export default UserGroupModel

export const userGroupRules = [
    check("name", "Name cannot be blank").not().isEmpty(),
    check("details", "User must be attached to a contact").not().isEmpty(),
    check("roles", "Groups require roles").isArray({min: 1})
]

export class UserGroupDto {
    id?: string
    name: string
    details: string
    roles: string[]
    static create({name, details, roles, id}: any): UserGroupDto {
        return {name, details, roles, id}
    }
}


