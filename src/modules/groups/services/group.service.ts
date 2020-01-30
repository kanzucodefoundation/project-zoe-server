import BaseQuery from "../../../data/BaseQuery";

import {hasValue} from "../../../utils/validation";
import {parseNumber} from "../../../utils/numberHelpers";
import {Group} from "../entities/Group";
import {DeleteResult, getRepository} from "typeorm";
import {LinqRepository} from "typeorm-linq-repository";

const repo = () => getRepository(Group);
const linqRepo = () => new LinqRepository(Group);
export const getByIdAsync = async (id: number): Promise<Group> => {
    return linqRepo().getById(id)
        .include(it => it.category)
        .include(it => it.parent);
};

export const createAsync = async (data: Group): Promise<Group> => {
    const created = await repo().save(data);
    return getByIdAsync(created.id);
};

export const searchAsync = async (q: BaseQuery): Promise<Group[]> => {

    const {skip = 0, limit = 10, query: sQuery}: BaseQuery = q;
    let query = linqRepo()
        .getAll();

    if (hasValue(sQuery)) {
        query = query
            .where(it => it.name )
            .contains(sQuery);
    }
    return query
        .include(u => u.category)
        .include(u => u.parent)
        .skip(parseNumber(skip))
        .take(parseNumber(limit))
        .toPromise();

};

export const updateAsync = async (data: any): Promise<Group> => {
    return await repo().save(data);
};


export const deleteAsync = async (id: string): Promise<DeleteResult> => {
    return await repo().delete( id);
};
