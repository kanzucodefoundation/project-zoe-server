import {Document, Model, Types} from "mongoose"
import IBaseQuery from "../data/BaseQuery";


export async function exitsAsync<T extends Document>(model: Model<T>, id: string): Promise<boolean> {
    return await model.exists({_id: new Types.ObjectId(id)})
}

export async function createAsync<T extends Document>(model: Model<T>, data: any): Promise<T> {
    const record = new model(data)
    return await record.save()
}


export async function getByIdAsync<T extends Document>(model: Model<T>, id: any): Promise<T> {
    return model.findOne({_id: new Types.ObjectId(id)})
}

export async function searchAsync<T extends Document>(model: Model<T>, conditions: any, query: IBaseQuery): Promise<T[]> {
    return model.find({...conditions}, null, {skip: query.skip, limit: query.limit});
}

export async function updateAsync<T extends Document>(model: Model<T>, {id, ...rest}: any, fetchNew: boolean = true): Promise<T> {
    const data: any = await model.updateOne({_id: new Types.ObjectId(id)}, rest);
    const {nModified, n, ok} = data
    if (nModified === 0) {
        throw new Error("No data changes made")
    }
    if (n === 0 || ok === 0) {
        throw new Error('Failed to update data');
    }
    if (fetchNew){
        return model.findById(id);
    }
}

export async function deleteAsync<T extends Document>(model: Model<T>, id: string): Promise<any> {
    const data: any = await model.deleteOne({_id: new Types.ObjectId(id)});
    const {deletedCount, n, ok} = data
    if (deletedCount === 0) {
        throw new Error("No record to delete")
    }
    if (n === 0 || ok === 0) {
        throw new Error('Failed to delete data');
    }
    return true;
}


