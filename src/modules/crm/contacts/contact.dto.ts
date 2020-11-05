import {ContactCategory, IContact, IEmail, IPerson, IPhone} from "../types";
import crypto from "crypto";
import {hasValue} from "../../../utils/validation";
import {check} from "express-validator";
import {isValidDate} from "../../../utils/dateHelpers";

export interface INewContact {
    //Person
    firstName: string
    lastName: string
    middleName?: string
    gender: string
    civilStatus: string
    dateOfBirth: Date
    //Address
    phone?: string
    email?: string
}


export const createPersonRules = [
    check("firstName", "First Name cannot be blank").not().isEmpty(),
    check("lastName", "Last Name cannot be blank").not().isEmpty(),
    check("gender", "Gender cannot be blank").not().isEmpty(),
    check("dateOfBirth", "Date of birth cannot be blank").custom(isValidDate),
    check("email", "Should be a valid email").optional().isEmail(),
]

const createAvatar = (email: string, size: number = 200) => {
    if (hasValue(email)) {
        const md5 = crypto.createHash("md5").update(email).digest("hex");
        return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
    }
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
};

export const dataToContact = (
    {
        firstName,
        lastName,
        middleName,
        gender,
        civilStatus,
        dateOfBirth,
        phone,
        email,
    }: INewContact
): IContact => {

    const person: IPerson = {
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        civilStatus: civilStatus,
        salutation: null,
        dateOfBirth: dateOfBirth,
        about: '',
        avatar: createAvatar(email),
        gender: gender
    }

    const phones: IPhone[] = hasValue(phone) ? [
        {
            category: 'Mobile',
            isPrimary: true,
            value: phone
        }
    ] : []

    const emails: IEmail[] = hasValue(email) ? [
        {
            category: 'Personal',
            isPrimary: true,
            value: email
        }
    ] : []

    const data: any = {
        category: ContactCategory.Person,
        person, phones, emails,
        addresses: [],
        identifications: [],
        occasions: [],
        metaData: {}
    }
    return {...data}
}
