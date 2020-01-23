import GroupMemberModel, {IGroupMember} from "../member/groupmember.model";

import {hasValue} from "../../../utils/validation";

import * as repo from "../../../utils/repository";
import {parseNumber} from "../../../utils/numberHelpers";
import {Types} from "mongoose";
import {badRequest} from "../../../utils/routerHelpers";
import {getPersonFullName} from "../../crm/types";

export const isMemberAsync = async (contact: string, group: string): Promise<boolean> => {
    return await GroupMemberModel.exists({
        contact: new Types.ObjectId(contact), group: new Types.ObjectId(group)
    });
};

export const createAsync = async (data: any): Promise<IGroupMember> => {
    const isMember = await isMemberAsync(data.contact, data.group);
    if (isMember)
        await Promise.reject(badRequest("Person is already a member"));
    const created = await repo.createAsync<IGroupMember>(GroupMemberModel, data);
    return getByIdAsync(created.id);
};

export const searchAsync = async (q: any): Promise<IGroupMember[]> => {
    const filter: any = {};
    if (hasValue(q.group)) {
        filter["group"] = q.group;
    }
    if (hasValue(q.contact)) {
        filter["contact"] = q.contact;
    }
    const data = await GroupMemberModel
        .find(filter, null, {skip: parseNumber(q.skip), limit: parseNumber(q.limit)})
        .populate("group", "name")
        .populate("contact", "person");
    return data.map(parseData);
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

export const updateAsync = async (data: any): Promise<IGroupMember> => {
    const updated = await repo.updateAsync<IGroupMember>(GroupMemberModel, data);
    return getByIdAsync(updated.id);
};

export const getByIdAsync = async (id: string): Promise<IGroupMember> => {
    const data = await GroupMemberModel
        .findById(id)
        .populate("group", "name")
        .populate("contact", "person");
    return parseData(data);
};

export const deleteAsync = async (id: string): Promise<IGroupMember> => {
    return repo.deleteAsync<IGroupMember>(GroupMemberModel, id);
};
