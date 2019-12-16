import bcrypt from 'bcryptjs'
import UserModel, {CreateUserDto, IUser, UpdateUserDto} from './users.model'
import * as repo from "../../../utils/repository";
import * as groupService from "../usergroup/usergroup.service";
import {hasValue, isValidPassword} from "../../../utils/validation";
import IBaseQuery from "../../../data/BaseQuery";

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


export const findByUsername = async (username: string, full: boolean = false): Promise<IUser> => {
    const user = await UserModel.findOne({username}).lean({virtuals: true});
    if (!full) {
        return user
    }
    const group = await groupService.getByNameAsync(user.group)
    if (!group) {
        await Promise.reject(`Invalid user group: ${user.group}`)
    } else {
        user.roles = group.roles
        return user
    }
};


export const searchAsync = async (q: IBaseQuery): Promise<IUser[]> => {
    const filter: any = {}
    if (hasValue(q.query)) {
        filter['username'] = {$regex: new RegExp(q.query), $options: 'i'}
    }
    return UserModel.find(filter, '-password', {skip: q.skip, limit: q.limit});
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
