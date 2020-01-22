import bcrypt from 'bcryptjs'
import {IQuery, LinqRepository} from "typeorm-linq-repository";

import * as groupService from "../usergroup/usergroup.service";
import {hasValue, isValidPassword} from "../../../utils/validation";
import IBaseQuery from "../../../data/BaseQuery";
import * as contactsService from "../../crm/contacts/contact.service";
import {getPersonFullName} from "../../crm/entities";
import {DeleteResult, getRepository} from "typeorm";
import {User} from "./user.entity";
import {parseNumber} from "../../../utils/numberHelpers";

const repo = () => getRepository(User)
const linqRepo = () => new LinqRepository(User)
// authentication will take approximately 13 seconds
// https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
const hashCost = 10;


export const findByUsername = async (username: string): Promise<any> => {
    const user = await linqRepo()
        .getOne().where(it=>it.username).equal(username)
        .include(u => u.contact)
        .thenInclude(c => c.person)
        .include(u => u.group)
        .toPromise()
    return user ? parseUser(user) : null
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
    let query: IQuery<User, User[]> = linqRepo()
        .getAll()
    if (hasValue(q.query)) {
        query = query
            .where(it => it.username)
            .contains(q.query)
    }
    const data = await query
        .include(u => u.contact)
        .thenInclude(c => c.person)
        .include(u => u.group)
        .skip(parseNumber(q.skip))
        .take(parseNumber(q.limit))
        .toPromise()
    return data.map(parseUser)
};


export const createAsync = async (data: User): Promise<User> => {
    await validateDataAsync(data)
    if (!isValidPassword(data.password)) {
        return Promise.reject(`Password too weak`)
    }
    const isValidGroup = await groupService.exitsAsync(data.group.id)
    if (!isValidGroup) {
        return Promise.reject(`Invalid group: ${data.group}`)
    }
    data.password = await bcrypt.hash(data.password, hashCost)
    return repo().save(data);
};

export const updateAsync = async (data: any): Promise<User> => {
    await validateDataAsync(data)
    if (hasValue(data.password)) {
        if (!isValidPassword(data.password)) {
            return Promise.reject(`Password too weak`)
        }
        data.password = await bcrypt.hash(data.password, hashCost)
    } else {
        // Just in case we have an empty string here
        delete data.password
    }
    await repo().save(data)
};

export const validateDataAsync = async (model: User): Promise<boolean> => {
    const groupExists = await groupService.exitsAsync(model.group.id)
    if (!groupExists) {
        await Promise.reject(`Invalid user group: ${model.group.id}`)
    }
    const contactExists = await contactsService.exitsAsync(model.contact.id)
    if (!contactExists) {
        await Promise.reject(`Invalid contact group: ${model.contact}`)
    }
    return true
};

export const getByIdAsync = async (id: number): Promise<any> => {
    const data = await repo().findOne(id);
    return parseUser(data)
};

export const deleteAsync = async (id: number): Promise<DeleteResult> => {
    return repo().delete({id})
};
