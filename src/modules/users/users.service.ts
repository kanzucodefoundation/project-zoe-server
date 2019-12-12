import bcrypt from 'bcryptjs'
import UserModel, {CreateUserDto, IUser, UpdateUserDto} from './users.model'
import * as repo from "../../utils/repository";
import {hasValue} from "../../utils/validation";
import IBaseQuery from "../../data/BaseQuery";

// authentication will take approximately 13 seconds
// https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
const hashCost = 10;

export const createAsync = async (data: any): Promise<IUser> => {
    const dt = CreateUserDto.create(data);
    dt.password = await bcrypt.hash(dt.password, hashCost)
    return repo.createAsync<IUser>(UserModel, dt)
};

export const findByUsername = async (username: string): Promise<IUser> => {
    return await UserModel.findOne({username}).exec();
};


export const searchAsync = async (q: IBaseQuery): Promise<IUser[]> => {
    const filter: any = {}
    if (hasValue(q.query)) {
        filter['username'] = new RegExp(`/${q.query}/i`)
    }
    return repo.searchAsync<IUser>(UserModel, filter, q)
};

export const updateAsync = async (data: any): Promise<IUser> => {
    const dt = UpdateUserDto.create(data);
    if (hasValue(dt.password)) {
        dt.password = await bcrypt.hash(dt.password, hashCost)
    } else {
        // Just in case we have an empty string here
        dt.password = undefined
    }
    return repo.updateAsync<IUser>(UserModel, dt)
};

export const deleteAsync = async (id: string): Promise<IUser> => {
    return repo.deleteAsync<IUser>(UserModel, id)
};
