import { RegisterUserDto } from "../../auth/dto/register-user.dto";
import { Gender } from "../../crm/enums/gender";
import { CivilStatus } from "../../crm/enums/civilStatus";
import { roleAdmin } from "../../auth/constants";

export const seedUsers: RegisterUserDto[] = [
  {
    firstName: "John",
    lastName: "Doe",
    middleName: "Emmanuel",
    gender: Gender.Male,
    civilStatus: CivilStatus.Married,
    dateOfBirth: new Date("1900-12-20"),
    phone: "0701123456",
    email: "john.doe@kanzucodefoundation.org",
    password: "Xpass@123",
    roles: [roleAdmin.role],
  },
  {
    firstName: "Jane",
    lastName: "Doe",
    middleName: null,
    gender: Gender.Female,
    civilStatus: CivilStatus.Married,
    dateOfBirth: new Date("1900-12-20"),
    phone: "0701123457",
    email: "jane.doe@kanzucodefoundation.org",
    password: "Password@1",
    roles: [roleAdmin.role],
  },
];
