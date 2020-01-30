import crypto from "crypto";
import {hasValue} from "../../../utils/validation";
import {check} from "express-validator";
import {isValidDate} from "../../../utils/dateHelpers";
import {Contact,} from "../entities/contact";
import {Person} from "../entities/person";
import {Phone} from "../entities/phone";
import {Email} from "../entities/email";
import {CivilStatus, ContactCategory, EmailCategory, Gender, PhoneCategory} from "../entities/enums";

export interface INewContact {
    //Person
    firstName: string
    lastName: string
    middleName?: string
    gender: Gender
    civilStatus: CivilStatus
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
): Contact => {

    const person = new Person()
    person.firstName = firstName
    person.middleName = middleName
    person.lastName = lastName
    person.civilStatus = civilStatus
    person.salutation = null
    person.dateOfBirth = dateOfBirth
    person.about = ''
    person.avatar = createAvatar(email)
    person.gender = gender

    const phones: Phone[] = []
    if (hasValue(phone)) {
        const p = new Phone()
        p.category = PhoneCategory.Mobile
        p.isPrimary = true
        p.value = phone
        phones.push(p)
    }

    const emails: Email[] = []
    if (hasValue(email)) {
        const e = new Email()
        e.category = EmailCategory.Personal
        e.isPrimary = true
        e.value = email
        emails.push(e)
    }
    const contact = new Contact()
    contact.category = ContactCategory.Person
    contact.person = person
    contact.phones = phones
    contact.emails = emails
    contact.addresses = []
    contact.identifications = []
    contact.occasions = []
    return contact
}
