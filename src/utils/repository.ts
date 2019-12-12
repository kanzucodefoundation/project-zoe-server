import {Document, Model} from "mongoose"
import IBaseQuery from "../data/BaseQuery";


export async function createAsync<T extends Document>(model: Model<T>, data: any): Promise<T> {
    const record = new model(data)
    return await record.save()
}

export async function searchAsync<T extends Document>(model: Model<T>, conditions: any, query: IBaseQuery): Promise<T[]> {
    return model.find({...conditions}, null, {skip: query.skip, limit: query.limit});
}

export async function updateAsync<T extends Document>(model: Model<T>, {id, ...rest}: any): Promise<T> {
    const data: any = await model.updateOne({_id: id}, rest);
    const {nModified, n, ok} = data
    if (nModified === 0) {
        throw new Error("No data changes made")
    }
    if (n === 0 || ok === 0) {
        throw new Error('Failed to update data');
    }
    return model.findById(id);
}

export async function deleteAsync<T extends Document>(model: Model<T>, id: string): Promise<any> {
    const data: any = await model.deleteOne({_id: id});
    const {deletedCount, n, ok} = data
    if (deletedCount === 0) {
        throw new Error("No record to delete")
    }
    if (n === 0 || ok === 0) {
        throw new Error('Failed to delete data');
    }
    return true;
}


