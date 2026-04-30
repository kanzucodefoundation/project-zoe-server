import { format, isValid, parse } from 'date-fns';
import { CreatePersonDto } from '../dto/create-person.dto';
import { Gender } from '../enums/gender';

const removeEmptySpaces = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  return `${value}`.replace(/\s+/g, ' ').trim();
};

type Name = {
  firstName: string;
  middleName?: string;
  lastName: string;
};

export const parseName = (name?: string): Name | null => {
  try {
    const cleanName = removeEmptySpaces(name);
    if (!cleanName) {
      return null;
    }
    const [firstName, middleName, ...others] = cleanName.split(' ');

    if (others.length > 0) {
      return {
        firstName,
        middleName,
        lastName: others.join(' '),
      };
    }
    return {
      firstName,
      lastName: middleName,
    };
  } catch (e) {
    console.log('Invalid name', name);
    return null;
  }
};

export const parseGender = (value?: string): Gender | null => {
  try {
    const clean = removeEmptySpaces(value)?.toLowerCase();
    if (!clean) {
      return null;
    }
    if (clean === 'male' || clean === 'm') return Gender.Male;
    if (clean === 'female' || clean === 'f') return Gender.Female;
  } catch (e) {
    console.log('Invalid Gender', value);
    return null;
  }
};

export const parseDateOfBirth = (dateOfBirthRaw?: string): string | null => {
  try {
    const cleanDateOfBirth = removeEmptySpaces(dateOfBirthRaw);
    if (!cleanDateOfBirth) {
      return null;
    }
    const dateFormats = [
      'd/M/yyyy',
      'dd/MM/yyyy',
      'd/MMM/yyyy',
      'dd/MMM/yyyy',
      'd/MMMM/yyyy',
      'dd/MMMM/yyyy',
    ];
    const dateOfBirthArray = cleanDateOfBirth
      .replace(/[-.]+/g, '/')
      .split(/[\/\s]+/); // Split on slash & whitespace
    if (/st|nd|rd|th/.test(dateOfBirthArray[0])) {
      // Support ordinal numbers, e.g. 1st, 2nd
      dateOfBirthArray[0] = dateOfBirthArray[0].replace(/st|nd|rd|th/gi, '');
    }
    const hasYear = dateOfBirthArray.length >= 3;
    const formattedDayMonth = dateOfBirthArray.join('/');
    const dateString = hasYear
      ? formattedDayMonth
      : `${formattedDayMonth}/1900`;
    const referenceDate = new Date(1900, 1, 1, 12, 0, 0);
    let dateOfBirth = null;
    for (const dateFormat of dateFormats) {
      try {
        dateOfBirth = parse(dateString, dateFormat, referenceDate);
        if (isValid(dateOfBirth)) break;
      } catch (e) {}
    }
    if (isValid(dateOfBirth)) return format(dateOfBirth, 'yyyy-MM-dd');
  } catch (e) {
    console.error(e);
  }
  return null;
};

const getValueByKeys = (rawObject: any, aliases: string[]) => {
  if (!rawObject || typeof rawObject !== 'object') {
    return undefined;
  }

  for (const alias of aliases) {
    const value = rawObject[alias];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  const normalizedAliases = aliases.map((alias) =>
    alias.toLowerCase().replace(/\s+/g, ''),
  );

  for (const [key, value] of Object.entries(rawObject)) {
    const normalizedKey = key
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/\s+/g, '');
    if (
      normalizedAliases.includes(normalizedKey) &&
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return undefined;
};

export function parseContact(rawContact: any): CreatePersonDto | null {
  try {
    const phone = getValueByKeys(rawContact, ['phone']);
    const name = getValueByKeys(rawContact, ['name', 'fullName', 'fullname']);
    const firstName = getValueByKeys(rawContact, ['firstName', 'firstname']);
    const middleName = getValueByKeys(rawContact, ['middleName', 'middlename']);
    const lastName = getValueByKeys(rawContact, ['lastName', 'lastname']);
    const email = getValueByKeys(rawContact, ['email']);
    const birthday = getValueByKeys(rawContact, ['birthday']);
    const dateOfBirth = getValueByKeys(rawContact, [
      'dateOfBirth',
      'dateofbirth',
      'dob',
    ]);
    const gender = getValueByKeys(rawContact, ['gender']);
    const residence = getValueByKeys(rawContact, ['residence']);
    const placeOfWork = getValueByKeys(rawContact, [
      'placeOfWork',
      'placeofwork',
    ]);
    const ageGroup = getValueByKeys(rawContact, ['ageGroup', 'agegroup']);

    const parsedName = parseName(name);
    const cleanFirstName =
      removeEmptySpaces(firstName) || parsedName?.firstName;
    const cleanLastName = removeEmptySpaces(lastName) || parsedName?.lastName;
    const cleanMiddleName =
      removeEmptySpaces(middleName) || parsedName?.middleName;

    return {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      middleName: cleanMiddleName,
      gender: parseGender(gender),
      dateOfBirth: parseDateOfBirth(dateOfBirth || birthday),
      email: removeEmptySpaces(email),
      phone: removeEmptySpaces(phone),
      placeOfWork: removeEmptySpaces(placeOfWork),
      residence: removeEmptySpaces(residence),
      ageGroup: removeEmptySpaces(ageGroup),
    };
  } catch (e) {
    console.error(e);
  }
  return null;
}
