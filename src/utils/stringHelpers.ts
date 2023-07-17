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
