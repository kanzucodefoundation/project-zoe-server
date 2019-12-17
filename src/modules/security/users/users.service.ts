import bcrypt from 'bcryptjs'
import UserModel, {CreateUserDto, IUser, UpdateUserDto} from './users.model'
import * as repo from "../../../utils/repository";
import * as groupService from "../usergroup/usergroup.service";
import {hasValue, isValidPassword} from "../../../utils/validation";
import IBaseQuery from "../../../data/BaseQuery";
import {getPersonFullName} from "../../crm/types";

// authentication will take approximately 13 seconds
// https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
const hashCost = 10;

export const createAsync = async (data: any): Promise<IUser> => {
    const dt = CreateUserDto.create(data);
    if (!isValidPassword(dt.password)) {
        return Promise.reject(`Password too weak`)
    }
    const isValidGroup = await groupService.exitsAsync(dt.group)
    if (!isValidGroup) {
        return Promise.reject(`Invalid group: ${dt.group}`)
    }
    dt.password = await bcrypt.hash(dt.password, hashCost)
    return repo.createAsync<IUser>(UserModel, dt)
};


export const findByUsername = async (username: string, full: boolean = false): Promise<any> => {
    const user = await UserModel
        .findOne({username})
        .populate('group')
        .populate('contact', "person")

    return user ? parseUser(user.toObject({virtuals: true})) : null
};


export const parseUser = ({id, username, password, contact, group}: any) => {
    return {
        id, username, password,
        contactId: contact.id,
        fullName: getPersonFullName(contact.person),
        groupId: group.id,
        group: group.name,
        roles: group.roles
    }
}

export const searchAsync = async (q: IBaseQuery): Promise<any[]> => {
    const filter: any = {}
    if (hasValue(q.query)) {
        filter['username'] = {$regex: new RegExp(q.query), $options: 'i'}
    }
    const data= await UserModel
        .find(filter, '-password', {skip: q.skip, limit: q.limit})
        .populate('group')
        .populate('contact', "person");
    return data.map(parseUser)
};

export const updateAsync = async (data: any): Promise<IUser> => {
    const dt = UpdateUserDto.create(data);
    if (hasValue(dt.password)) {
        if (!isValidPassword(dt.password)) {
            return Promise.reject(`Password too weak`)
        }
        dt.password = await bcrypt.hash(dt.password, hashCost)
    } else {
        // Just in case we have an empty string here
        delete dt.password
    }
    const updated = await repo.updateAsync<IUser>(UserModel, dt)
    delete updated.password
    return updated
};

export const getByIdAsync = async (id: string): Promise<IUser> => {
    return repo.getByIdAsync<IUser>(UserModel, id)
};

export const deleteAsync = async (id: string): Promise<IUser> => {
    return repo.deleteAsync<IUser>(UserModel, id)
};
