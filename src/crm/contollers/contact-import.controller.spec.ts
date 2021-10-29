import {
  parseContact,
  parseDateOfBirth,
  parseName,
} from '../utils/importUtils';

describe('ContactImportController', () => {
  beforeEach(async () => {});

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
      dateOfBirth: '20/Feb',
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
  });
});
