import {Document, model, Schema} from "mongoose";
import {check} from "express-validator";
import {configureId} from "../../../utils/schemaUtils";

const userSchema = new Schema({
    username: {
        type: String,
        index: true,
        unique: true,
        required: true,
    },
    contactId: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    group: {
        type: String,
        required: true,
    }
}, {});
configureId(userSchema)

export interface IUser extends Document {
    username: string
    contactId: string
    password: string
    group: string
}

const UserModel = model<IUser>('User', userSchema);

export default UserModel

export const createUserRules = [
    check("username", "username cannot be blank").not().isEmpty(),
    check("contactId", "User must be attached to a contact").not().isEmpty(),
    check("password", "Password cannot be blank").not().isEmpty()
        .isLength({min: 6}),
    check("group", "User must be in a group").not().isEmpty()
]

export const editUserRules = [
    check("id", "Id is required").not().isEmpty(),
    check("group", "User must be attached to a contact").not().isEmpty(),
    check("password", "Password should be at least 6 characters").isLength({min: 6})
]

export class CreateUserDto {
    public username: string
    public contactId: string
    public password: string
    public group: string

    static create({username, contactId, password, group}: any): CreateUserDto {
        return {username, contactId, password, group}
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
