import {Document} from "mongoose";

export enum ContactCategory {
    Person = 'Person',
    Company = 'Company',
}

export interface IPerson extends Partial<Document>{
    salutation: string,
    firstName: string
    lastName: string
    middleName: string
    about: string
    gender: string
    civilStatus: string
    avatar: string
    dateOfBirth: Date
}

export interface IEmail extends Partial<Document>{
    id?: string
    value: string
    category: string
    isPrimary: boolean
}

export enum IdentificationCategory {
    Nin = 'Nin',
    Passport = 'Passport',
    DrivingPermit = 'DrivingPermit',
    VillageCard = 'VillageCard',
    Nssf = 'Nssf',
    Other = 'Other'
}

export enum CivilStatus {
    Other = 'Other',
    Single = 'Single',
    Married = 'Married',
    Divorced = 'Divorced'
}

export enum Gender {
    Male = 'Male',
    Female = 'Female',
}

export enum PhoneCategory {
    Mobile = "Mobile",
    Office = "Office",
    Home = "Home",
    Fax = "Fax",
    Other = "Other"
}

export enum RelationshipCategory {
    Mother = 'Mother',
    Father = 'Father',
    Daughter = 'Daughter',
    Son = 'Son',
    Fiancee = 'Fiancee',
    Sister = 'Sister',
    Brother = 'Brother',
    Other = 'Other',
}

export enum OccasionCategory {
    Birthday = 'Birthday',
    Anniversary = 'Anniversary',
    Salvation = 'Salvation',
    Engaged = 'Engaged',
    Other = 'Other'
}

export enum EmailCategory {
    Work = 'Work',
    Personal = 'Personal',
    Other = 'Other',
}

export enum AddressCategory {
    Work = 'Work',
    Home = 'Personal',
    Other = 'Other',
}

export interface IPhone extends Partial<Document> {
    id?: string
    value: string
    category: string
    isPrimary: boolean
}

export interface IIdentification extends Partial<Document> {
    id?: string
    value: string
    cardNumber?: string
    issuingCountry: string
    startDate: Date
    expiryDate: Date
    category: string
    isPrimary: boolean
}

export interface IAddress extends Partial<Document> {
    id?: string
    category: AddressCategory
    isPrimary: boolean
    country: string
    district: string
    county: string
    subCounty?: string
    village?: string
    parish?: string
    postalCode?: string
    street?: string

    freeForm?: string
    latLon?: string
    placeId?: string
}

export interface ICompany extends Partial<Document> {
    name: string
}

export interface IOccasion extends Partial<Document> {
    id?: string
    value: Date
    details: string
    category: OccasionCategory
}

export interface IContact extends Document {
    id?: string
    category: string
    person: IPerson
    emails: IEmail[]
    phones: IPhone[]
    occasions: IOccasion[]
    addresses: IAddress[]
    identifications: IIdentification[]
    company?: ICompany
    tags?: string[]
    metaData: any
}

export const getPersonFullName = (person: IPerson): string => {
    const name = `${person.firstName || ''} ${person.middleName || ''} ${person.lastName || ''}`;
    return name.trim().replace(/\s+/g, ' ');
};
