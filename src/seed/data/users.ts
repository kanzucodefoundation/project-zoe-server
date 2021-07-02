import { RegisterUserDto } from '../../auth/dto/register-user.dto';
import { Gender } from '../../crm/enums/gender';
import { CivilStatus } from '../../crm/enums/civilStatus';
import { roleAdmin } from '../../auth/constants';

export const seedUsers: RegisterUserDto[] = [
  {
    firstName: 'Timothy',
    lastName: 'Kasasa',
    middleName: 'Emmanuel',
    gender: Gender.Male,
    civilStatus: CivilStatus.Married,
    dateOfBirth: new Date('1900-12-20'),
    phone: '0701035517',
    email: 'ekastimo@gmail.com',
    password: 'Xpass@123',
    roles: [roleAdmin.role],
  },
  {
    firstName: 'Peter',
    lastName: 'Kakoma',
    middleName: null,
    gender: Gender.Male,
    civilStatus: CivilStatus.Married,
    dateOfBirth: new Date('1900-12-20'),
    phone: '0701035517',
    email: 'kakoma@kanzucode.com',
    password: 'Password@1',
    roles: [roleAdmin.role],
  },
];
