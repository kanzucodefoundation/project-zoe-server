import {
  parseContact,
  parseDateOfBirth,
  parseName,
} from '../utils/importUtils';

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
