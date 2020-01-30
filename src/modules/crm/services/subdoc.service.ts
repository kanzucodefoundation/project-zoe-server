import {badRequest} from "../../../utils/routerHelpers";
import {hasValue} from "../../../utils/validation";
import {getRepository, Repository} from "typeorm";
import {Contact} from "../entities/contact";
import {recordExists} from "../../../utils/orm/repoUtils";

const contactRepo = () => getRepository(Contact);

export default class DependentService {
    repo: () => Repository<any>;
    key: string;

    constructor(repo: () => Repository<any>, key: string) {
        this.repo = repo;
        this.key = key;
    }

    createAsync = async (model: any): Promise<any> => {
        if (!hasValue(model.contactId)) {
            await Promise.reject(badRequest("Invalid contact"));
        }
        const exists = recordExists(contactRepo(), model.contactId);
        if (!exists) {
            await Promise.reject(badRequest(`Invalid contact :${model.contactId}`));
        }
        const isDup = await recordExists(this.repo(), model[this.key], this.key);
        if (isDup) {
            await Promise.reject(badRequest(`Duplicate record :${model[this.key]}`));
        }
        const toSave = {...model, contact: Contact.ref(model.contactId)};
        const data = await this.repo().save(toSave);
        return this.cleanId(data);
    };

    updateAsync = async (model: any): Promise<any> => {
        if (!hasValue(model.contactId)) {
            await Promise.reject(badRequest("Invalid contact"));
        }
        const exists = recordExists(contactRepo(), model.contactId);
        if (!exists) {
            await Promise.reject(badRequest(`Invalid contact :${model.contactId}`));
        }

        const toUpdate = {...model, contact: Contact.ref(model.contactId)};
        const data = await this.repo().save(toUpdate);
        return this.cleanId(data);
    };

    cleanId({contact, ...rest}: any): any {
        return {...rest, contactId: contact.id};
    }

    deleteAsync = async (id: string): Promise<any> => {
        return await this.repo().delete(id);
    }
}

