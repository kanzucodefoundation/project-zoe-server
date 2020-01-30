import {hasValue} from "../../../utils/validation";

import {parseNumber} from "../../../utils/numberHelpers";
import {badRequest} from "../../../utils/routerHelpers";

import {DeleteResult, getRepository} from "typeorm";
import {LinqRepository} from "typeorm-linq-repository";
import {GroupMember} from "../entities/GroupMember";
import {getPersonFullName} from "../../crm/entities";

const repo = () => getRepository(GroupMember);
const linqRepo = () => new LinqRepository(GroupMember);
export const isMemberAsync = async (contact: number, group: number): Promise<boolean> => {
    const count = await repo()
        .createQueryBuilder("g")
        .where("g.contact = :contact", {contact})
        .andWhere("g.group = :group", {group})
        .getCount();
    return count > 0;
};


function parseData(model: any) {
    if (!model)
        return null;
    const data = model.toObject({virtuals: true});
    return {
        ...data,
        contact: {
            id: data.id,
            name: getPersonFullName(data.contact.person)
        }
    };
}

export const getByIdAsync = async (id: number): Promise<GroupMember> => {
    const data = await linqRepo().getById(id)
        .include(it=>it.contact)
        .include(it=>it.group);
    return parseData(data);
};

export const createAsync = async (data: any): Promise<GroupMember> => {
    const isMember = await isMemberAsync(data.contact, data.group);
    if (isMember)
        await Promise.reject(badRequest("Person is already a member"));
    const created = await repo().save(data);
    return getByIdAsync(created.id);
};

export const searchAsync = async (q: any): Promise<GroupMember[]> => {

    const {skip = 0, limit = 10, groupId,contactId}: any = q;
    let query = linqRepo()
        .getAll();

    if (hasValue(groupId)) {
        query = query
            .where(it => it.groupId )
            .equal(groupId);
    }

    if (hasValue(contactId)) {
        query = query
            .where(it => it.contactId )
            .equal(contactId);
    }
    const data = await query
        .include(u => u.contact)
        .include(u => u.group)
        .skip(parseNumber(skip))
        .take(parseNumber(limit))
        .toPromise();

    return data.map(parseData);
};

export const updateAsync = async (data: any): Promise<GroupMember> => {
    const updated = await repo().save(data);
    return getByIdAsync(updated.id);
};

export const deleteAsync = async (id: number): Promise<DeleteResult> => {
    return await repo().delete(id);
};
