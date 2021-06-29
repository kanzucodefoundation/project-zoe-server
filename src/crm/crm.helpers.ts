import Contact from './entities/contact.entity';
import Person from './entities/person.entity';
import Company from './entities/company.entity';
import Email from './entities/email.entity';
import Phone from './entities/phone.entity';
import Address from './entities/address.entity';
import Occasion from './entities/occasion.entity';
import Identification from './entities/identification.entity';
import { hasNoValue, hasValue } from 'src/utils/validation';
import * as crypto from 'crypto';
import Relationship from './entities/relationship.entity';
import Request from './entities/request.entity';
import Group from '../groups/entities/group.entity';

export const getPersonFullName = (person: Partial<Person>): string => {
  if (hasNoValue(person)) {
    return '';
  }
  const name = `${person.firstName || ''} ${person.middleName || ''} ${
    person.lastName || ''
  }`;
  return name.trim().replace(/\s+/g, ' ');
};

export const crmEntities = [
  Contact,
  Person,
  Company,
  Email,
  Phone,
  Address,
  Occasion,
  Identification,
  Relationship,
  Request,
];

export const createAvatar = (email: string, size = 200) => {
  if (hasValue(email)) {
    const md5 = crypto.createHash('md5').update(email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
  }
  return `https://gravatar.com/avatar/?s=${size}&d=retro`;
};

export const getPhoneObj = (data: Contact): Phone => {
  const { phones } = data;
  if (phones && phones.length > 0) {
    const pri = phones.find((it) => it.isPrimary);
    if (pri) return pri;
    else return phones[0];
  }
  return {} as Phone;
};

export const getEmail = (data: Contact): string => {
  const { emails } = data;
  if (emails && emails.length > 0) {
    const pri = emails.find((it) => it.isPrimary);
    if (pri) return pri.value;
    else return emails[0].value;
  }
  return '';
};

export const getEmailObj = (data: Contact): Email => {
  const { emails } = data;
  if (emails && emails.length > 0) {
    const pri = emails.find((it) => it.isPrimary);
    if (pri) return pri;
    else return emails[0];
  }
  return {} as Email;
};

export const getPhone = (data: Contact): string => {
  const { phones } = data;
  if (phones && phones.length > 0) {
    const pri = phones.find((it) => it.isPrimary);
    if (pri) return pri.value;
    else return phones[0].value;
  }
  return '';
};

export const getCellGroup = (data: Contact): Group | null => {
  const { groupMemberships } = data;
  if (hasValue(groupMemberships)) {
    const pri = groupMemberships.find(
      (it) => it.group?.categoryId.toLocaleLowerCase() === 'mc',
    );
    if (pri) {
      return pri.group;
    }
  }
  return null;
};

export const getLocation = (data: Contact): Group | null => {
  const { groupMemberships } = data;
  if (hasValue(groupMemberships)) {
    const pri = groupMemberships.find(
      (it) => it.group?.categoryId.toLocaleLowerCase() === 'location',
    );
    if (pri) {
      return pri.group;
    }
  }
  return null;
};
