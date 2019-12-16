import GroupModel, {GroupDto, IGroup} from "./group.model";
import IBaseQuery from "../../../data/BaseQuery";

import {hasValue} from "../../../utils/validation";

import * as repo from "../../../utils/repository";
import {parseNumber} from "../../../utils/numberHelpers";

export const exitsAsync = async (name: string): Promise<boolean> => {
    return await GroupModel.exists({name})
};

export const createAsync = async (data: any): Promise<IGroup> => {
    const dt = GroupDto.create(data);
    return await repo.createAsync<IGroup>(GroupModel, dt)
};

export const searchAsync = async (q: IBaseQuery): Promise<IGroup[]> => {
    const filter: any = {}
    if (hasValue(q.query)) {
        filter['name'] = {$regex: new RegExp(q.query), $options: 'i'}
    }
    return GroupModel.find(filter, null, {skip: parseNumber(q.skip), limit: parseNumber(q.limit)});
};

export const updateAsync = async (data: any): Promise<IGroup> => {
    const dt = GroupDto.create(data);
    return await repo.updateAsync<IGroup>(GroupModel, dt)
};

export const getByIdAsync = async (id: string): Promise<IGroup> => {
    return repo.getByIdAsync<IGroup>(GroupModel, id)
};

export const deleteAsync = async (id: string): Promise<IGroup> => {
    return repo.deleteAsync<IGroup>(GroupModel, id)
};
