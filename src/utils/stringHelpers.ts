import { User } from "src/users/entities/user.entity";

export const lowerCaseRemoveSpaces = (name: string): string => {
  return name?.toLowerCase().replace(/\s/g, "");
};

export function generateRandomPassword(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters.charAt(randomIndex);
  }

  return password;
}

/**
 * Generate the current date in the YYYYMMDD format
 * @param currentDate Date
 * @returns string Date in the YYYYMMDD format
 */
export function getFormattedDateString(currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function getUserDisplayName(user: User): string {
  const firstName = user?.contact?.person?.firstName ?? "";
  const lastName = user?.contact?.person?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`;
  const displayName: string =
    fullName.trim() !== "" ? fullName : user ? user.username : "";
  return displayName;
}

/**
 * Returns a human-readable date of the form: September 7, 2023, 06:43:39 AM GMT+3
 *
 * @param date
 * @returns string
 */
export function getHumanReadableDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
