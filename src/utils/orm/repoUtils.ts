import {Repository} from "typeorm";


export const recordExists = async (repository: Repository<any>, value: any, name: string = "id"): Promise<boolean> => {
    const count = await repository.count({where: {[name]: value}});
    return count >= 1;
};
