import {Contact} from "./contact";
import {Person} from "./person";
import {Company} from "./company";
import {Email} from "./email";
import {Phone} from "./phone";
import {Address} from "./address";
import {Occasion} from "./occasion";
import {Identification} from "./identification";


export const getPersonFullName = (person: Person): string => {
    const name = `${person.firstName || ""} ${person.middleName || ""} ${person.lastName || ""}`;
    return name.trim().replace(/\s+/g, " ");
};


export const crmEntities = [Contact, Person, Company, Email, Phone, Address, Occasion, Identification];
