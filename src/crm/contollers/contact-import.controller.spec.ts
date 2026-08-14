import {
  parseContact,
  parseDateOfBirth,
  parseName,
} from '../utils/importUtils';
import {
  mapContactHeaders,
  DuplicateContactHeaderError,
} from './contact-import.controller';

describe('ContactImportController', () => {
  it('parseContacts create a person', async () => {
    const data = {
      name: 'Full Name',
      phone: '0700106164',
      email: 'email@test.com',
      dateOfBirth: '20/Feb',
    };
    expect(parseContact(data)).toEqual({
      firstName: 'Full',
      lastName: 'Name',
      middleName: undefined,
      phone: '0700106164',
      email: 'email@test.com',
      dateOfBirth: '1900-02-20',
      ageGroup: undefined,
      gender: null,
      placeOfWork: undefined,
      residence: undefined,
    });
  });

  it('parseContacts supports firstName and lastName columns', async () => {
    const data = {
      firstName: 'Moira',
      lastName: 'Murungi Nageri',
      phone: 256784092081,
      email: 'murungimoira@gmail.com',
      dateOfBirth: '3/9/1996',
      gender: 'Female',
    };

    expect(parseContact(data)).toEqual({
      firstName: 'Moira',
      lastName: 'Murungi Nageri',
      middleName: undefined,
      phone: '256784092081',
      email: 'murungimoira@gmail.com',
      dateOfBirth: '1996-09-03',
      ageGroup: undefined,
      gender: 'Female',
      placeOfWork: undefined,
      residence: undefined,
    });
  });
  it('parseName works', async () => {
    expect(parseName('Timothy Emmanuel Kasasa')).toEqual({
      firstName: 'Timothy',
      lastName: 'Kasasa',
      middleName: 'Emmanuel',
    });
    expect(parseName('Timothy Kasasa')).toEqual({
      firstName: 'Timothy',
      lastName: 'Kasasa',
      middleName: undefined,
    });
    expect(parseName('Timothy')).toEqual({
      firstName: 'Timothy',
      lastName: undefined,
      middleName: undefined,
    });
  });

  it('parseDateOfBirth works', async () => {
    expect(parseDateOfBirth('20/Dec')).toEqual('1900-12-20');
    expect(parseDateOfBirth('20/12')).toEqual('1900-12-20');
    expect(parseDateOfBirth('31/March')).toEqual('1900-03-31');
    expect(parseDateOfBirth('3/9/1996')).toEqual('1996-09-03');
  });
});
describe('mapContactHeaders', () => {
  it('maps human-readable headers to canonical camelCase keys', () => {
    expect(
      mapContactHeaders([
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Date of Birth',
        'Gender',
        'District',
        'Country',
        'Group ID',
      ]),
    ).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
      'dateOfBirth',
      'gender',
      'district',
      'country',
      'groupId',
    ]);
  });

  it('is tolerant of separator and casing variants', () => {
    expect(
      mapContactHeaders(['first_name', 'LAST-NAME', 'DateOfBirth']),
    ).toEqual(['firstName', 'lastName', 'dateOfBirth']);
  });

  it('strips a leading BOM from the first header', () => {
    expect(mapContactHeaders(['\uFEFFFirst Name', 'Last Name'])).toEqual([
      'firstName',
      'lastName',
    ]);
  });

  it('passes unknown headers through unchanged', () => {
    expect(
      mapContactHeaders(['First Name', 'Favorite Color', 'groupName']),
    ).toEqual(['firstName', 'Favorite Color', 'groupName']);
  });

  it('throws when two headers resolve to the same canonical field', () => {
    expect(() =>
      mapContactHeaders(['Email', 'email', 'First Name']),
    ).toThrow(DuplicateContactHeaderError);
  });

  it('throws for duplicate aliases with different original spellings', () => {
    expect(() =>
      mapContactHeaders(['Group ID', 'groupid', 'First Name']),
    ).toThrow(/Duplicate column for "groupId"/);
  });

  it('does not treat repeated unknown headers as duplicates', () => {
    expect(() =>
      mapContactHeaders(['Notes', 'Notes', 'First Name']),
    ).not.toThrow();
  });
});
