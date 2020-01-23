import GroupModel, {IGroup} from "./group.model";
import IBaseQuery from "../../../data/BaseQuery";

import {hasValue} from "../../../utils/validation";

import * as repo from "../../../utils/repository";
import {parseNumber} from "../../../utils/numberHelpers";

export const getByIdAsync = async (id: string): Promise<any> => {
    return GroupModel
        .findById(id)
        .populate("category", "name")
        .populate("parent", "name");
};

export const createAsync = async (data: any): Promise<IGroup> => {
    const created = await repo.createAsync<IGroup>(GroupModel, data);
    return getByIdAsync(created.id);
};

export const searchAsync = async (q: IBaseQuery): Promise<IGroup[]> => {
    const filter: any = {};
    if (hasValue(q.query)) {
        filter["name"] = {$regex: new RegExp(q.query), $options: "i"};
    }
    return GroupModel.find(filter, null, {skip: parseNumber(q.skip), limit: parseNumber(q.limit)})
        .populate("category", "name")
        .populate("parent", "name");
};

export const updateAsync = async (data: any): Promise<IGroup> => {
    return await repo.updateAsync<IGroup>(GroupModel, data);
};


export const deleteAsync = async (id: string): Promise<IGroup> => {
    return repo.deleteAsync<IGroup>(GroupModel, id);
};
