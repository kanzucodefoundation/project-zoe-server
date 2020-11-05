import UserGroupModel, {IUserGroup, UserGroupDto} from './usergroup.model'
import * as repo from "../../../utils/repository";


export const exitsAsync = async (id: string): Promise<boolean> => {
    return repo.exitsAsync(UserGroupModel, id)
};

export const createAsync = async (data: any): Promise<IUserGroup> => {
    const dt = UserGroupDto.create(data);
    return await repo.createAsync<IUserGroup>(UserGroupModel, dt)
};

export const getByIdAsync = async (id: string): Promise<IUserGroup> => {
    return UserGroupModel.findById(id)
};

export const getByNameAsync = async (name: string): Promise<IUserGroup> => {
    return UserGroupModel.findOne({name})
};
