import {model, Schema} from "mongoose";
import {configureId} from "../../../utils/schemaHelpers";
import {enumToArray} from "../../../utils/enumHelpers";
import {
    AddressCategory,
    CivilStatus,
    ContactCategory,
    EmailCategory,
    Gender,
    IContact,
    IdentificationCategory,
    OccasionCategory,
    PhoneCategory,
    RelationshipCategory
} from "../types";

export enum GroupPrivacy {
    Private = "Private",
    Public = "Public"
}

const personSchema = new Schema({
    salutation: String,
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    middleName: {
        type: String,
    },
    gender: {
        type: String,
        required: true,
        enum: enumToArray(Gender)
    },
    dateOfBirth: {type: Date},
    civilStatus: {
        type: String,
        enum: enumToArray(CivilStatus)
    },
    avatar: String,
    about: String
},{_id:false});

const emailSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(EmailCategory),
        default: EmailCategory.Personal
    },
    value: {
        type: String,
        required: true
    },
    isPrimary: {
        type: Boolean,
        required: true
    }
})

const occasionSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(OccasionCategory),
        default: OccasionCategory.Birthday
    },
    value: {
        type: Date,
        required: true
    },
    details: String,
    isPrimary: {
        type: Boolean,
        required: true,
        default:false
    }
})

const phoneSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(PhoneCategory),
        default: PhoneCategory.Mobile
    },
    value: {
        type: String,
        required: true
    },
    isPrimary: {
        type: Boolean,
        required: true,
        default:false
    }
})

const relationshipSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(RelationshipCategory),
        default: RelationshipCategory.Other
    },
    rootId: {
        type: String,
        required: true
    },
    referenceId: {
        type: String,
        required: true
    },
})

const identificationSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(IdentificationCategory),
        default: IdentificationCategory.Nin
    },
    value: {
        type: String,
        required: true
    },
    cardNumber: {
        type: String
    },
    issuingCountry: {
        type: String,
        required: true
    },
    issueDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isPrimary: {
        type: Boolean,
        required: true
    }
})

const addressSchema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(AddressCategory),
        default: AddressCategory.Home
    },
    country: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    freeForm: {
        type: String,
        required: true
    },
    placeId: {
        type: String
    },
    latLon: {
        type: String
    },
    isPrimary: {
        type: Boolean,
        required: true
    }
})

const schema = new Schema({
    category: {
        type: String,
        required: true,
        enum: enumToArray(ContactCategory),
        default: GroupPrivacy.Public
    },
    person: personSchema,
    emails: [emailSchema],
    phones: [phoneSchema],
    occasions: [occasionSchema],
    addresses: [addressSchema],
    identifications: [identificationSchema],
    relationships: [relationshipSchema],
    tags: {type: [String], index: true},
    metaData: {},
});
configureId(schema)
configureId(emailSchema)
configureId(phoneSchema)
configureId(occasionSchema)
configureId(addressSchema)
configureId(identificationSchema)
configureId(relationshipSchema)


const ContactModel = model<IContact>('Contact', schema);
export default ContactModel
