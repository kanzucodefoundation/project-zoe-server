import {badRequest} from "../../../utils/routerHelpers";
import ContactModel from "./contact.model";
import {hasValue} from "../../../utils/validation";
import {Types} from "mongoose";
import {cleanUpId, inArray, updateDocument} from "../../../utils/mongoHelpers";

export const createAsync = async (childName: string, contactId: string, model: any): Promise<any> => {
    if (!hasValue(contactId)) {
        await Promise.reject(badRequest('Invalid contact'))
    }
    const contact: any = await ContactModel.findById(contactId);
    if (!contact) {
        await Promise.reject(badRequest(`Invalid contact :${contactId}`))
    }
    if (inArray(contact[childName], model, 'value')) {
        await Promise.reject(badRequest(`Duplicate record :${model.value}`))
    }
    const newEntry = {_id: new Types.ObjectId(), ...model}
    contact[childName].push(newEntry)
    await contact.save()
    return cleanUpId(newEntry);
}

export const updateAsync = async (childName: string, contactId: string, data: any): Promise<any> => {
    if (!hasValue(contactId)) {
        await Promise.reject(badRequest('Invalid contact'))
    }
    const contact: any = await ContactModel.findById(contactId);
    if (!contact) {
        await Promise.reject(badRequest(`Invalid contact :${contactId}`))
    }
    const {id, ...model} = data
    const updateIndex = contact[childName].findIndex((it: any) => it._id.toHexString() === id)
    const toUpdate = contact[childName][updateIndex]
    updateDocument(toUpdate, model)
    await contact.save()
    return cleanUpId(toUpdate.toObject());
}


export const deleteAsync = async (childName: string, contactId: string, id: string): Promise<any> => {
    if (!hasValue(contactId)) {
        await Promise.reject(badRequest('Invalid contact'))
    }
    if (!hasValue(id)) {
        await Promise.reject(badRequest('Invalid record'))
    }
    const contact: any = await ContactModel.findById(contactId);
    if (!contact) {
        await Promise.reject(badRequest(`Invalid contact :${contactId}`))
    }
    const updateIndex = contact[childName].findIndex((it: any) => it._id.toHexString() === id)
    const toRemove: any = contact[childName][updateIndex]
    toRemove.remove()
    await contact.save()
    return {message: 'Operation successful'}
}
