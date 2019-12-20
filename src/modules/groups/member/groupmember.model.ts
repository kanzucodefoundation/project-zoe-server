import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaHelpers";
import {enumToArray} from "../../../utils/enumHelpers";

export enum GroupRole {
    Member = "Member",
    Leader = "Leader"
}

const schema = new Schema({
    group: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Group'
    },
    contact: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Contact'
    },
    role: {
        type: String,
        required: true,
        enum: enumToArray(GroupRole),
        default: GroupRole.Member
    }
});
configureId(schema)

export interface IGroupMember extends Document {
    id?: string
    group: any
    contact: string
    role: GroupRole
}

const GroupMemberModel = model<IGroupMember>('GroupMember', schema);

export default GroupMemberModel

export const createMemberRules = [
    check("group", "group is required").not().isEmpty(),
    check("contact", "contact is required").not().isEmpty(),
    check("role", "role is required").not().isEmpty()
]

export const editMemberRules = [
    check("id", "id is required").not().isEmpty(),
    ...createMemberRules
]
