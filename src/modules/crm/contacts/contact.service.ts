import IBaseQuery, {IContactQuery} from "../../../data/BaseQuery";
import {hasValue} from "../../../utils/validation";
import {IContact} from "../types";
import {dataToContact} from "./contact.dto";
import {getRepository} from "typeorm";
import {Contact} from "../entities/contact";
import logger from "../../../utils/logging/logger";
import {ContactCategory} from "../entities/enums";
import {Phone} from "../entities/phone";
import {Email} from "../entities/email";
import {LinqRepository} from "typeorm-linq-repository";
import {parseNumber} from "../../../utils/numberHelpers";


const repo = () => getRepository(Contact)

const linqRepo = () => new LinqRepository(Contact)
export const exitsAsync = async (id: number): Promise<boolean> => {
    const count = await repo().count({id})
    return count >= 1
};

export const createPersonAsync = async (data: any): Promise<Contact> => {
    logger.info(`creating person`)
    const dt = dataToContact(data);
    const model = new Contact();
    model.category = ContactCategory.Person
    model.person = {...dt.person}

    const contact = await getRepository(Contact).save(model)
    logger.info(`creating phones for ${contact.id}`)
    const phones = dt.phones.map(it => {
        return {...it, contact}
    })
    const savedPhones = await getRepository(Phone).save(phones)
    logger.info(`creating emails for ${contact.id}`)
    const emails = dt.emails.map(it => {
        return {...it, contact}
    })
    const savedEmails = await getRepository(Email).save(emails)
    contact.phones = savedPhones
    contact.emails = savedEmails
    return contact
};

// TODO Add validation
export const createAsync = async (data: any): Promise<IContact> => {
    return await repo().save(data)
};

export const searchAsync = async (q: IContactQuery): Promise<Contact[]> => {
    let query = linqRepo()
        .getAll()
    let wPerson = query
        .include(c => c.person)
    if (hasValue(q.query)) {
        query = wPerson
            .where(it => it.person.firstName)
            .contains(q.query)
            .or(it => it.person.lastName)
            .contains(q.query)
            .or(it => it.person.middleName)
            .contains(q.query)
    }
    return query
        .include(u => u.phones)
        .include(u => u.emails)
        .skip(parseNumber(q.skip))
        .take(parseNumber(q.limit))
        .toPromise();
};

export const createQuery = (q: IBaseQuery) => {
    const filter: any = {}
    if (hasValue(q.query)) {
        const regex = {$regex: new RegExp(q.query), $options: 'i'}
        filter['$or'] = [
            {'person.firstName': regex},
            {'person.lastName': regex},
            {'person.middleName': regex}
        ]
    }
    return filter
}

export const getByIdAsync = async (id: string): Promise<Contact> => {
    return repo().findOne(parseInt(id))
};

export const deleteAsync = async (id: string): Promise<any> => {
    return repo().delete(parseInt(id))
};
