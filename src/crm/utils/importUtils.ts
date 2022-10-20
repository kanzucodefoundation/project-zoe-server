import { format, isValid, parse } from "date-fns";
import { CreatePersonDto } from "../dto/create-person.dto";
import { Gender } from "../enums/gender";

const removeEmptySpaces = (str?: string) => {
  try {
    return str.replace(/\s+/g, " ").trim();
  } catch (e) {
    console.log("Invalid text", str);
  }
};

type Name = {
  firstName: string;
  middleName?: string;
  lastName: string;
};

export const parseName = (name?: string): Name | null => {
  try {
    const [firstName, middleName, ...others] = removeEmptySpaces(name).split(
      " ",
    );

    if (others.length > 0) {
      return {
        firstName,
        middleName,
        lastName: others.join(" "),
      };
    }
    return {
      firstName,
      lastName: middleName,
    };
  } catch (e) {
    console.log("Invalid name", name);
    return null;
  }
};

export const parseGender = (value?: string): Gender | null => {
  try {
    const clean = removeEmptySpaces(value).toLowerCase();
    if (clean === "male" || clean === "m") return Gender.Male;
    if (clean === "female" || clean === "f") return Gender.Female;
  } catch (e) {
    console.log("Invalid Gender", value);
    return null;
  }
};

export const parseDateOfBirth = (name?: string): string | null => {
  try {
    const dateFormats = ["dd/MM/yyyy", "dd/MMM/yyyy", "dd/MMMM/yyyy"];
    const cleanData = removeEmptySpaces(name);
    const dateString = `${cleanData}/1900`;
    const dateRef = new Date(1900, 1, 1, 12, 0, 0);
    let dateOfBirth = null;
    for (const dateFormat of dateFormats) {
      try {
        dateOfBirth = parse(dateString, dateFormat, dateRef);
        if (isValid(dateOfBirth)) break;
      } catch (e) {}
    }
    if (isValid(dateOfBirth)) return format(dateOfBirth, "yyyy-MM-dd");
  } catch (e) {
    console.error(e);
  }
  return null;
};

export function parseContact({
  phone,
  name,
  email,
  birthday,
  gender,
  residence,
  placeOfWork,
  ageGroup,
}: any): CreatePersonDto | null {
  try {
    const { firstName, lastName, middleName } = parseName(name);
    return {
      firstName,
      lastName,
      middleName,
      gender: parseGender(gender),
      dateOfBirth: parseDateOfBirth(birthday),
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
