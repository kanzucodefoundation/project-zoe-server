import {RegisterUserDto} from '../../auth/dto/register-user.dto';
import {Gender} from '../../crm/enums/gender';
import {CivilStatus} from '../../crm/enums/civilStatus';
import {MinistryCategories} from '../../services/enums/ministryCategories';
import {rolesList} from "../../auth/constants";

export const seedUsers: RegisterUserDto[] = [
    {
        category: 'Person',
        firstName: 'Timothy',
        lastName: 'Kasasa',
        middleName: 'Emmanuel',
        gender: Gender.Male,
        civilStatus: CivilStatus.Married,
        dateOfBirth: new Date('1900-12-20'),
        phone: '0701035517',
        email: 'ekastimo@gmail.com',
        password: 'Xpass@123',
        roles: rolesList,
        ministry: MinistryCategories.Unspecified,
        profession: null,
    },
    {
        category: 'Person',
        firstName: 'Peter',
        lastName: 'Kakoma',
        middleName: null,
        gender: Gender.Male,
        civilStatus: CivilStatus.Married,
        dateOfBirth: new Date('1900-12-20'),
        phone: '0701035517',
        email: 'kakoma@kanzucode.com',
        password: 'Password@1',
        roles: rolesList,
        ministry: MinistryCategories.Unspecified,
        profession: null,
    },
];
