import {getRepository} from "typeorm";
import {UserGroup} from "./usergroup.entity";


const repo = ()=>getRepository(UserGroup)

export const exitsAsync = async (id: number): Promise<boolean> => {
    const resp = await repo().count({where: {id}})
    return resp >= 1
};

export const createAsync = async (data: any): Promise<UserGroup> => {
    return await repo().save(data)
};

export const getByIdAsync = async (id: number): Promise<UserGroup> => {
    return repo().findOne(id)
};

export const getByNameAsync = async (name: string): Promise<UserGroup> => {
    return repo().findOne({where:{name}})
};
