import UserGroupModel, {IUserGroup} from './usergroup.model'


export const exitsAsync = async (name: string): Promise<boolean> => {
    return await UserGroupModel.exists({name})
};

export const getByNameAsync = async (name: string): Promise<IUserGroup> => {
    return UserGroupModel.findOne({name})
};
