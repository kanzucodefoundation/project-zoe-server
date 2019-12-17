import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaHelpers";

const userSchema = new Schema({
    username: {
        type: String,
        index: true,
        unique: true,
        required: true,
    },
    contact: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Contact'
    },
    password: {
        type: String,
        required: true
    },
    group: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'UserGroup'
    }
}, {});
configureId(userSchema)

export interface IUser extends Document {
    username: string
    password: string
    contactId?: any
    contact: any
    groupId: any
    group: any
    roles?: string[]
}

const UserModel = model<IUser>('User', userSchema);

export default UserModel

export const createUserRules = [
    check("username", "username cannot be blank").not().isEmpty(),
    check("contact", "User must be attached to a contact").not().isEmpty(),
    check("password", "Password cannot be blank").not().isEmpty(),
    check("group", "User must be in a group").not().isEmpty()
]

export const editUserRules = [
    check("id", "Id is required").not().isEmpty(),
    check("group", "User must be attached to a contact").not().isEmpty()
]

export class CreateUserDto {
    public username: string
    public contact: string
    public password: string
    public group: string

    static create({username, contact, password, group}: any): CreateUserDto {
        return {username, contact, password, group}
    }
}

export class UpdateUserDto {
    public id: string
    public password: string
    public group: string

    static create({id, password, group}: any): UpdateUserDto {
        return {id, password, group}
    }
}

export const cleanUpUser = (user: any) => {
    delete user['password']
    delete user['_id']
    delete user['__v']
}
