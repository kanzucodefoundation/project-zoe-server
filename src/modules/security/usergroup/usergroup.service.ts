import UserGroupModel from './usergroup.model'


export const exitsAsync = async (name: string): Promise<boolean> => {
    return await UserGroupModel.exists({name})
};
